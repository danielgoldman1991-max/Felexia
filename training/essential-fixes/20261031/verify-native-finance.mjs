// Dedicated loopback PostgreSQL only; three synthetic users, no .env or credentials.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const option=key=>process.argv.find(arg=>arg.startsWith(`--${key}=`))?.slice(key.length+3);
const connectionString=option("postgres-url"); const target=new URL(connectionString);
if(!["127.0.0.1","localhost"].includes(target.hostname)||!/^\/numbering_qa_[a-z0-9_]+$/i.test(target.pathname)||target.username!=="postgres"||target.password)throw Error("Dedicated local numbering_qa_ database required");
const require=createRequire(resolve(option("pg-root"),"package.json")); const {Client}=require("pg");
const [observer,first,second]=Array.from({length:3},(_,i)=>new Client({connectionString,application_name:`essential-finance-${i}`}));
const fixture=JSON.parse(await readFile(new URL("native-finance-fixture.json",import.meta.url),"utf8"));
const results=[];let checks=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;results.push(label);};
const one=async(client,query,params=[])=> (await client.query(query,params)).rows[0];
const settled=promise=>promise.then(value=>({value}),error=>({error}));
async function begin(client,user=fixture.admin){await client.query("begin");await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);await client.query("set local role authenticated; set local statement_timeout='10s'");}
async function authenticated(client,user,operation){await begin(client,user);try{const value=await operation();await client.query("commit");return value;}catch(error){await client.query("rollback");throw error;}}
const payment=client=>one(client,"select * from create_customer_payment_atomic($1,$2,$3,100,$4::date,gen_random_uuid())",[fixture.org,fixture.customer,fixture.bank,fixture.period]);
const entryHeader=id=>({journal_id:fixture.journal,entry_date:fixture.period,status:"posted",label:"Concurrent synthetic payment",source_document_type:"customer_payment",source_document_id:id});
const lines=[{account_id:fixture.accountA,debit:100,credit:0},{account_id:fixture.accountB,debit:0,credit:100}];
const post=(client,id)=>one(client,"select * from save_accounting_entry_atomic($1,null,$2::jsonb,$3::jsonb)",[fixture.org,JSON.stringify(entryHeader(id)),JSON.stringify(lines)]);
const cancel=(client,id)=>one(client,"select * from cancel_customer_payment_atomic($1,$2)",[fixture.org,id]);
let secondPid;
async function blocked(label){let result;for(let i=0;i<100;i++){result=await one(observer,"select wait_event_type from pg_stat_activity where pid=$1",[secondPid]);if(result?.wait_event_type==="Lock")break;await new Promise(done=>setTimeout(done,15));}equal(result?.wait_event_type,"Lock",label);}
try{
  await Promise.all([observer,first,second].map(client=>client.connect()));
  secondPid=Number((await one(second,"select pg_backend_pid() pid")).pid);
  equal(Number((await one(observer,"select count(*) n from organization_members where organization_id=$1 and status='active'",[fixture.org])).n),3,"Native company has exactly three active synthetic users");
  const sale=await authenticated(first,fixture.operator,()=>one(first,"select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb) id",[fixture.org,JSON.stringify({customer_id:fixture.customer,invoice_date:fixture.period}),JSON.stringify([{description:"Small fractional service",quantity:1,unit_price_ht:0.05,discount_rate:10,tax_rate:20}])]));
  const saleTotals=await one(observer,"select subtotal_ht,tax_total,total_ttc from customer_invoices where id=$1",[sale.id]);
  equal(Number(saleTotals.total_ttc),0.05,"Fractional-cent document has coherent rounded TTC");
  equal(Number(saleTotals.subtotal_ht)+Number(saleTotals.tax_total),Number(saleTotals.total_ttc),"Rounded HT plus VAT equals TTC exactly");
  await authenticated(first,fixture.admin,()=>first.query("update customer_invoices set status='validated' where id=$1",[sale.id]));
  const credit=await authenticated(first,fixture.operator,()=>one(first,"select save_customer_credit_note_atomic($1,null,$2::jsonb,$3::jsonb) id",[fixture.org,JSON.stringify({customer_id:fixture.customer,source_invoice_id:sale.id,credit_note_date:fixture.period,reason:"Synthetic correction"}),JSON.stringify([{description:"Credit small service",quantity:1,unit_price_ht:0.05,discount_rate:10,tax_rate:20}])]));
  await authenticated(first,fixture.admin,()=>first.query("update customer_credit_notes set status='validated',available_amount=total_ttc where id=$1",[credit.id]));
  await authenticated(first,fixture.operator,()=>first.query("select apply_customer_credit_note_atomic($1,$2,$3::jsonb)",[fixture.org,credit.id,JSON.stringify([{invoice_id:sale.id,amount:0.05}])]));
  equal(Number((await one(observer,"select remaining_amount from customer_invoices where id=$1",[sale.id])).remaining_amount),0,"Combined 098099100 credit application settles invoice");
  const application=await one(observer,"select id from customer_credit_note_applications where credit_note_id=$1 and cancelled_at is null",[credit.id]);
  await authenticated(first,fixture.operator,()=>first.query("select unapply_customer_credit_note_atomic($1,$2)",[fixture.org,application.id]));
  equal(Number((await one(observer,"select remaining_amount from customer_invoices where id=$1",[sale.id])).remaining_amount),0.05,"Combined correction restores invoice outstanding amount");

  const firstPayment=await authenticated(first,fixture.admin,()=>payment(first));
  await begin(first);const firstPosted=await post(first,firstPayment.payment_id);await begin(second);let pending=settled(post(second,firstPayment.payment_id));
  await blocked("Concurrent posting of one payment waits on its source lock");await first.query("commit");let result=await pending;assert.ifError(result.error);await second.query("commit");
  equal(result.value.entry_id,firstPosted.entry_id,"Concurrent retry returns the same committed entry");
  equal(Number((await one(observer,"select count(*) n from accounting_entries where organization_id=$1 and source_document_type='customer_payment' and source_document_id=$2",[fixture.org,firstPayment.payment_id])).n),1,"Concurrent posting produces one source entry");

  const secondPayment=await authenticated(first,fixture.admin,()=>payment(first));
  await begin(first);await post(first,secondPayment.payment_id);await begin(second);pending=settled(cancel(second,secondPayment.payment_id));await blocked("Payment cancellation waits for its in-flight posting");
  await first.query("commit");result=await pending;equal(result.error?.message,"FINANCE_POSTED_PAYMENT_READ_ONLY","Cancellation racing committed posting is refused");await second.query("rollback");
  equal((await one(observer,"select status from customer_payments where id=$1",[secondPayment.payment_id])).status,"confirmed","Refused concurrent cancellation preserves payment");

  const thirdPayment=await authenticated(first,fixture.admin,()=>payment(first));
  await begin(first);await cancel(first,thirdPayment.payment_id);await begin(second);pending=settled(post(second,thirdPayment.payment_id));await blocked("Posting waits for an in-flight payment cancellation");
  await first.query("commit");result=await pending;equal(result.error?.message,"FINANCE_SOURCE_NOT_POSTABLE","Posting cannot resurrect a cancelled payment");await second.query("rollback");
  equal(Number((await one(observer,"select count(*) n from accounting_entries where source_document_id=$1",[thirdPayment.payment_id])).n),0,"Cancelled source leaves no orphan accounting entry");

  const fourthPayment=await authenticated(first,fixture.admin,()=>payment(first));
  await begin(first);const aborted=await post(first,fourthPayment.payment_id);await begin(second);pending=settled(post(second,fourthPayment.payment_id));await blocked("Second posting waits for an uncommitted first attempt");
  await first.query("rollback");result=await pending;assert.ifError(result.error);await second.query("commit");equal(result.value.entry_number,aborted.entry_number,"Rolled-back posting does not consume a committed number");
  equal(Number((await one(observer,"select count(*) n from accounting_entry_lines where entry_id=$1",[result.value.entry_id])).n),2,"Resumed posting commits its complete balanced lines");
  const readOnly=await authenticated(first,fixture.viewer,()=>one(first,"select count(*) n from customer_invoices where organization_id=$1",[fixture.org]));equal(Number(readOnly.n)>0,true,"Third user can read the company invoice history");
  let viewerError;try{await authenticated(first,fixture.viewer,()=>one(first,"select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb)",[fixture.org,JSON.stringify({customer_id:fixture.customer}),JSON.stringify([{description:"Forbidden",quantity:1,unit_price_ht:1}])]))}catch(error){viewerError=error.message;}
  equal(viewerError,"FINANCE_WRITE_REQUIRED","Third user cannot create an invoice through the RPC");
  const reconciliation=await one(observer,"select a.current_balance,coalesce((select sum(case when direction='in' then amount else -amount end) from treasury_transactions t where t.treasury_account_id=a.id and archived_at is null),0) net from treasury_accounts a where a.id=$1",[fixture.bank]);
  equal(Number(reconciliation.current_balance),Number(reconciliation.net),"Native treasury account and active movements reconcile after races");
  const report={passed:true,date:new Date().toISOString(),engine:"Native PostgreSQL",migrations:[98,99,100],threeSyntheticUsers:true,checks,results,productionDataRead:false,productionDataWritten:false,localFixtureDatabaseRetainedForRestoreTest:true};
  await writeFile(new URL("native-finance-concurrency.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({passed:true,checks,results}));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,code:error.code,where:error.where}));process.exitCode=1;}
finally{await Promise.all([observer,first,second].map(async client=>{await client.query("rollback").catch(()=>{});await client.end();}));}
