// Real competing transactions in a dedicated loopback PostgreSQL QA database.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
const option=key=>process.argv.find(arg=>arg.startsWith(`--${key}=`))?.slice(key.length+3);
const connectionString=option("postgres-url");const target=new URL(connectionString);
if(!["localhost","127.0.0.1"].includes(target.hostname)||!/^\/numbering_qa_[a-z0-9_]+$/i.test(target.pathname)||target.username!=="postgres"||target.password)throw Error("Dedicated local PostgreSQL QA database required");
const require=createRequire(resolve(option("pg-root"),"package.json"));const {Client}=require("pg");
const [observer,first,second]=Array.from({length:3},()=>new Client({connectionString}));
const fixture=JSON.parse(await readFile(new URL("native-finance-fixture.json",import.meta.url),"utf8"));
const results=[];let checks=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;results.push(label);};
const one=async(db,sql,args=[])=> (await db.query(sql,args)).rows[0];
async function begin(db){await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[fixture.operator]);await db.query("set local role authenticated;set local statement_timeout='10s'");}
async function commit(db,run){await begin(db);try{const answer=await run();await db.query("commit");return answer;}catch(error){await db.query("rollback");throw error;}}
const apply=(db,note,invoice,amount)=>one(db,"select apply_supplier_credit_note_atomic($1,$2,$3::jsonb)",[fixture.org,note,JSON.stringify([{invoice_id:invoice,amount}])]);
const pay=(db,invoice,amount)=>one(db,"select * from create_supplier_payment_atomic(p_organization_id=>$1,p_supplier_id=>$2,p_treasury_account_id=>$3,p_amount=>$4,p_payment_date=>$5::date,p_idempotency_key=>gen_random_uuid(),p_allocations=>$6::jsonb)",[fixture.org,fixture.supplier,fixture.bank,amount,fixture.period,JSON.stringify([{invoice_id:invoice,amount}])]);
const settled=promise=>promise.then(value=>({value}),error=>({error}));
let secondPid;
async function blocked(label){let state;for(let i=0;i<100;i++){state=await one(observer,"select wait_event_type from pg_stat_activity where pid=$1",[secondPid]);if(state?.wait_event_type==="Lock")break;await new Promise(done=>setTimeout(done,15));}equal(state?.wait_event_type,"Lock",label);}
const serial=`RACE-${Date.now()}`;
const documents=[];
async function seed(suffix,creditTotal){return commit(first,async()=>{
 const purchase=await one(first,"select save_supplier_invoice_atomic($1,null,$2::jsonb,$3::jsonb) id",[fixture.org,JSON.stringify({supplier_id:fixture.supplier,supplier_invoice_number:serial+suffix}),JSON.stringify([{description:"Synthetic competing purchase",quantity:1,unit_price_ht:100,tax_rate:20}])]);
 await first.query("update supplier_invoices set status='validated' where id=$1",[purchase.id]);
 const note=await one(first,"select save_supplier_credit_note_atomic($1,null,$2::jsonb,$3::jsonb) id",[fixture.org,JSON.stringify({supplier_id:fixture.supplier,supplier_credit_note_number:serial+suffix,source_invoice_id:purchase.id}),JSON.stringify([{description:"Synthetic competing credit",quantity:1,unit_price_ht:creditTotal,tax_rate:0}])]);
 await first.query("update supplier_credit_notes set status='validated',available_amount=total_ttc where id=$1",[note.id]);
 documents.push({purchase:purchase.id,note:note.id});return {purchase:purchase.id,note:note.id};
});}
try{
 await Promise.all([observer,first,second].map(db=>db.connect()));secondPid=Number((await one(second,"select pg_backend_pid() pid")).pid);
 const balance=Number((await one(observer,"select current_balance from treasury_accounts where id=$1",[fixture.bank])).current_balance);
 const creditFirst=await seed("-CREDIT-FIRST",30);
 await begin(first);await apply(first,creditFirst.note,creditFirst.purchase,30);
 await begin(second);let pending=settled(pay(second,creditFirst.purchase,100));await blocked("Payment waits for an in-flight supplier credit allocation");
 await first.query("commit");let result=await pending;assert.match(result.error?.message??"",/SUPPLIER_INVOICE_BALANCE_EXCEEDED/);checks++;results.push("Payment racing a committed credit cannot overpay the invoice");await second.query("rollback");
 equal(Number((await one(observer,"select remaining_amount from supplier_invoices where id=$1",[creditFirst.purchase])).remaining_amount),90,"Credit-first race leaves the exact invoice remainder");
 equal(Number((await one(observer,"select current_balance from treasury_accounts where id=$1",[fixture.bank])).current_balance),balance,"Rejected competing payment creates no cash movement");
 const cashFirst=await seed("-CASH-FIRST",40);
 await begin(first);const cash=await pay(first,cashFirst.purchase,90);
 await begin(second);pending=settled(apply(second,cashFirst.note,cashFirst.purchase,40));await blocked("Credit allocation waits for an in-flight supplier payment");
 await first.query("commit");result=await pending;assert.match(result.error?.message??"",/CREDIT_INVOICE_BALANCE_EXCEEDED/);checks++;results.push("Credit racing a committed payment cannot over-allocate the invoice");await second.query("rollback");
 const invoiceState=await one(observer,"select paid_amount,credit_amount,remaining_amount from supplier_invoices where id=$1",[cashFirst.purchase]);
 equal([Number(invoiceState.paid_amount),Number(invoiceState.credit_amount),Number(invoiceState.remaining_amount)],[90,0,30],"Cash-first race preserves cash and credit separation");
 equal(Number((await one(observer,"select available_amount from supplier_credit_notes where id=$1",[cashFirst.note])).available_amount),40,"Refused racing allocation preserves the supplier credit availability");
 await commit(first,async()=>{await one(first,"select * from cancel_supplier_payment_atomic($1,$2)",[fixture.org,cash.payment_id]);for(const doc of documents){const applications=await first.query("select id from supplier_credit_note_applications where credit_note_id=$1 and cancelled_at is null",[doc.note]);for(const application of applications.rows)await one(first,"select unapply_supplier_credit_note_atomic($1,$2)",[fixture.org,application.id]);await first.query("update supplier_credit_notes set status='cancelled',available_amount=0 where id=$1",[doc.note]);await first.query("update supplier_invoices set status='cancelled' where id=$1",[doc.purchase]);}});
 equal(Number((await one(observer,"select current_balance from treasury_accounts where id=$1",[fixture.bank])).current_balance),balance,"Cancelling synthetic nonposted fixtures restores the original bank balance");
 const report={passed:true,date:new Date().toISOString(),engine:"Native PostgreSQL",checks,results,syntheticFixtureHistoryRetained:true,noProductionRead:true,noProductionWrite:true};await writeFile(new URL("supplier-credit-concurrency.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await Promise.all([observer,first,second].map(async db=>{await db.query("rollback").catch(()=>{});await db.end();}));}
