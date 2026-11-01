// Disposable SQL only; no env, network or production URL is accepted.
import {readFile,writeFile,mkdtemp,rm,rmdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import vm from 'node:vm';
if(!process.argv.some(a=>a.startsWith('--pglite-root='))||process.argv.some(a=>a.includes('postgres-url')))throw Error('Explicit disposable PGlite required');
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const require=createRequire(import.meta.url);const ts=require('typescript');const frontend={exports:{}};
const compiled=ts.transpileModule(await readFile(join(root,'src/lib/sales-calculations.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInThisContext(`(function(module,exports){${compiled}\n})`,{filename:'src/lib/sales-calculations.ts'})(frontend,frontend.exports);
const calculationCases=[
 {quantity:1.005,unit_price_ht:1,discount_rate:20,tax_rate:20,expected:[0.8,0.16,0.96]},
 {quantity:0.333,unit_price_ht:9.99,discount_rate:12.5,tax_rate:20,expected:[2.91,0.58,3.49]},
 {quantity:0.005,unit_price_ht:1,discount_rate:0,tax_rate:20,expected:[0.01,0,0.01]},
 {quantity:1,unit_price_ht:0.03,discount_rate:0,tax_rate:20,expected:[0.03,0.01,0.04]},
].map(c=>({...c,ui:frontend.exports.calculateSalesLine(c)}));
const baseline=(await readFile(join(root,'training/essential-fixes/20261031/verify-subscription-access.mjs'),'utf8')).replace(/\r\n/g,'\n');
const marker='\ntry {\n  await bootstrap();';if(!baseline.includes(marker))throw Error('Review changed bootstrap');
let source=baseline.slice(0,baseline.indexOf(marker)).replace('new URL(`../../../supabase/migrations/${file}`, import.meta.url)','new URL(file,'+JSON.stringify(pathToFileURL(join(root,'supabase/migrations/')).href)+')');
source+='\nconst output='+JSON.stringify(join(fileURLToPath(new URL('./',import.meta.url)),(process.argv.includes('--installer')?'installer-':'database-')+(process.argv.includes('--relaxed-v3')?'relaxed':'strict')+'.json'))+';\n';
source+='const calculationCases='+JSON.stringify(calculationCases)+';\n';
source+='const installerSql='+JSON.stringify(await readFile(join(root,'supabase/pro-transactions-105-106.sql'),'utf8'))+';\n';
source+=String.raw`
try {
 await bootstrap();
 await db.exec("do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;");
 for(const file of ['016_sales_documents_payment_terms.sql','082_hr_module.sql','097_document_numbering_controls.sql','099_essential_subscription_access.sql','104_pro_erp_write_access.sql',...(process.argv.includes('--installer')?[]:['105_pro_commercial_transactions.sql','106_preparatory_payroll_transactions.sql'])]){phase=file;await db.exec(await sql(file));}
 if(process.argv.includes('--installer')){phase='installer105106';await db.exec(installerSql);}
 // Reinstallation is additive/idempotent.
 await db.exec(await sql('105_pro_commercial_transactions.sql'));await db.exec(await sql('106_preparatory_payroll_transactions.sql'));
 await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;begin');
 for(const [org,name] of [[ids.org,'PRO transaction disposable'],[ids.foreign,'Foreign disposable']])await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[org,name]);
 for(const [user,name] of [[ids.admin,'admin'],[ids.viewer,'viewer'],[ids.operator,'operator']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@example.test']);await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@example.test']);
  const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[ids.org,name]);await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[ids.org,user,role.id]);
 }
 await as(ids.admin);await db.query('select ensure_essential_trial($1)',[ids.org]);await as(null);await db.exec('reset role');
 await db.query("update organization_subscriptions set plan_code='premium',plan_id=(select id from subscription_plans where code='premium'),status='active',current_period_end=now()+interval '1 month' where organization_id=$1",[ids.org]);
 const foreignParty=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Foreign','FOREIGN','customer',array['customer']) returning id",[ids.foreign]);
 await as(ids.admin);
 const party=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Party','PARTY','customer',array['customer','supplier']) returning id",[ids.org]);
 const header={customer_id:party.id,supplier_id:party.id,document_date:'2026-11-01',notes:'Original'};
 const line={description:'Synthetic line',quantity:1,unit_price_ht:100,tax_rate:20};
 const save=async(kind,id=null,stamp=null,lines=[line],h=header)=> (await one('select save_pro_commercial_document_atomic($1,$2,$3,$4,$5::jsonb,$6::jsonb) id',[ids.org,id,kind,stamp,JSON.stringify(h),JSON.stringify(lines)])).id;
 const snapshot=async(kind,id)=>JSON.stringify({header:await one('select * from '+(kind==='supplier_order'?'purchase_documents':'sales_documents')+' where id=$1',[id]),lines:(await db.query('select * from '+(kind==='supplier_order'?'purchase_document_lines':'sales_document_lines')+' where document_id=$1 order by id',[id])).rows});
 const stamp=async(kind,id)=>(await one('select updated_at::text value from '+(kind==='supplier_order'?'purchase_documents':'sales_documents')+' where id=$1',[id])).value;
 phase='commercial';
 for(const kind of ['quote','order','supplier_order']){
  const id=await save(kind);equal(Boolean(id),true,kind+' created atomically');const before=await snapshot(kind,id);const version=await stamp(kind,id);
  await rejected(()=>save(kind,id,version,[line,{...line,quantity:-1}]),/PRO_INVALID_LINE/,kind+' bad second line rejected');equal(await snapshot(kind,id),before,kind+' failed replacement preserves exact header and lines');
  await save(kind,id,version,[{...line,unit_price_ht:200}]);equal(Number((await one('select total_ttc from '+(kind==='supplier_order'?'purchase_documents':'sales_documents')+' where id=$1',[id])).total_ttc),240,kind+' SQL totals recomputed');
  await rejected(()=>save(kind,id,version),/PRO_DOCUMENT_CHANGED/,kind+' stale version cannot overwrite newer draft');
  await rejected(()=>save(kind,id,null),/PRO_DOCUMENT_CHANGED/,kind+' missing version refuses');
 }
 for(const c of calculationCases){
  const id=await save('quote',null,null,[{...line,...c}]);const stored=await one('select subtotal_ht,tax_total,total_ttc from sales_documents where id=$1',[id]);
  for(const [index,field,uiField]of [[0,'subtotal_ht','subtotal_ht'],[1,'tax_total','tax_amount'],[2,'total_ttc','total_ttc']]){
   equal(c.ui[uiField],c.expected[index],'Frontend independent rounding '+c.quantity+'/'+c.discount_rate+' '+field);
   equal(Number(stored[field]),c.expected[index],'Atomic SQL agrees with independent rounding '+c.quantity+'/'+c.discount_rate+' '+field);
  }
 }
 const quote=await save('quote');
 const beforeCount=Number((await one('select count(*) n from sales_documents')).n);
 await rejected(()=>save('quote',null,null,[line,{...line,unit_price_ht:-1}]),/PRO_INVALID_LINE/,'Failed creation rolls back header and all lines');equal(Number((await one('select count(*) n from sales_documents')).n),beforeCount,'No orphan after failed creation');
 await rejected(()=>save('quote',null,null,[line],{...header,customer_id:foreignParty.id}),/PRO_RELATED_RECORD_INVALID/,'Foreign party refused');
 await rejected(async()=>save('quote',quote,await stamp('quote',quote),[{...line,quantity:'NaN'}]),/PRO_INVALID_LINE/,'Nonfinite amount refused');
 const indivisible=await one("insert into units(organization_id,name,symbol) values($1,'U','kg') returning id",[ids.org]);
 await rejected(()=>save('quote',null,null,[{...line,unit_id:indivisible.id,unit_name:'kg',quantity:1.5}]),/PRO_INDIVISIBLE_QUANTITY/,'Reference unit name U cannot be bypassed by symbol or payload');
 const customerOnly=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Customer only','ONLY-C','customer',array['customer']) returning id",[ids.org]);
 const prospect=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Prospect','ONLY-P','prospect',array['prospect']) returning id",[ids.org]);
 await rejected(()=>save('supplier_order',null,null,[line],{...header,supplier_id:customerOnly.id}),/PRO_RELATED_RECORD_INVALID/,'Customer-only party cannot become supplier order');
 equal(Boolean(await save('order',null,null,[line],{...header,customer_id:prospect.id})),true,'Prospect order remains supported before confirmation converts customer');
 equal(Boolean(await save('quote',null,null,[line],{...header,customer_id:prospect.id})),true,'Prospect can receive quote');
 const metadata={...header,valid_until:'2026-12-01',notes:'Customer notes',internal_notes:'Internal',payment_terms:'custom',payment_method:'transfer',payment_terms_days:30,custom_payment_terms:'Agreed terms',custom_payment_method:'Agreed method'};
 const richQuote=await save('quote',null,null,[line],metadata);const richRow=await one('select * from sales_documents where id=$1',[richQuote]);
 for(const field of ['notes','internal_notes','payment_terms','payment_method','payment_terms_days','custom_payment_terms','custom_payment_method'])equal(richRow[field],metadata[field],'Quote preserves form field '+field);
 const vat=await one("insert into tax_rates(organization_id,name,rate) values($1,'VAT20',20) returning id",[ids.org]);
 await rejected(()=>save('quote',null,null,[{...line,tax_rate_id:vat.id,tax_rate:0}]),/PRO_TAX_RATE_CHANGED/,'Referenced VAT cannot be overridden by payload');
 const supplierOrder=await save('supplier_order');await db.query("update purchase_documents set currency='EUR' where id=$1",[supplierOrder]);
 const supplierNumber=(await one('select document_number from purchase_documents where id=$1',[supplierOrder])).document_number;
 await save('supplier_order',supplierOrder,await stamp('supplier_order',supplierOrder),[line],{...header,currency:'USD',document_number:'MUST-NOT-CHANGE'});
 equal((await one('select currency from purchase_documents where id=$1',[supplierOrder])).currency,'EUR','Existing currency remains unchanged');equal((await one('select document_number from purchase_documents where id=$1',[supplierOrder])).document_number,supplierNumber,'Assigned number cannot be overwritten');
 phase='quote conversion';
 const convert=async(id)=>(await one('select convert_pro_quote_to_order_atomic($1,$2) id',[ids.org,id])).id;
 const conversionQuote=await save('quote',null,null,[line],{...metadata,customer_id:prospect.id});
 const converted=await convert(conversionQuote);equal(await convert(conversionQuote),converted,'Repeated conversion returns exactly the existing order');
 equal(Number((await one("select count(*) n from sales_documents where document_type='order' and source_document_id=$1",[conversionQuote])).n),1,'One order per quote after two requests');
 const convertedRow=await one('select * from sales_documents where id=$1',[converted]);equal(convertedRow.customer_id,prospect.id,'Prospect quote converts before customer promotion');equal(Number(convertedRow.total_ttc),120,'Conversion preserves quoted TTC');
 equal(convertedRow.custom_payment_terms,metadata.custom_payment_terms,'Conversion preserves agreed payment terms');equal((await one('select related_order_id from sales_documents where id=$1',[conversionQuote])).related_order_id,converted,'Source links the same order');
 for(const stage of ['line','source']){
  const q=await save('quote');const before=await snapshot('quote',q);const count=Number((await one('select count(*) n from sales_documents')).n);
  await as(null);await db.exec('reset role');
  await db.exec(stage==='line'?"create function public.audit_fail_conversion() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_CONVERSION_FAILURE';end $$; create trigger zzz_conversion_fail before insert on sales_document_lines for each row execute function public.audit_fail_conversion();":"create function public.audit_fail_conversion() returns trigger language plpgsql as $$ begin if new.status='converted' then raise exception 'SYNTHETIC_CONVERSION_FAILURE';end if;return new;end $$; create trigger zzz_conversion_fail before update on sales_documents for each row execute function public.audit_fail_conversion();");
  await as(ids.admin);await rejected(()=>convert(q),/SYNTHETIC_CONVERSION_FAILURE/,'Conversion failure at '+stage+' aborts');equal(await snapshot('quote',q),before,'Conversion '+stage+' failure preserves exact source');equal(Number((await one('select count(*) n from sales_documents')).n),count,'Conversion '+stage+' failure leaves no order orphan');
  await as(null);await db.exec('reset role;drop trigger zzz_conversion_fail on '+(stage==='line'?'sales_document_lines':'sales_documents')+';drop function audit_fail_conversion();');await as(ids.admin);
 }
 const corruptQuote=await save('quote');await db.query("update sales_documents set total_ttc='NaN' where id=$1",[corruptQuote]);
 await rejected(()=>convert(corruptQuote),/PRO_INVALID_DOCUMENT/,'Conversion refuses legacy nonfinite header instead of copying it');
 const corruptLineQuote=await save('quote');await db.query("update sales_document_lines set quantity='NaN' where document_id=$1",[corruptLineQuote]);
 await rejected(()=>convert(corruptLineQuote),/PRO_INVALID_LINE/,'Conversion refuses legacy nonfinite line instead of copying it');
 await db.query("update sales_documents set status='sent' where id=$1",[quote]);await rejected(async()=>save('quote',quote,await stamp('quote',quote)),/PRO_DRAFT_REQUIRED/,'Sent quote read only');
 const employee=await one("insert into hr_employees(organization_id,employee_number,first_name,last_name,hire_date,base_salary) values($1,'EMP','Synthetic','Employee',current_date,10000) returning id",[ids.org]);
 await db.query("insert into hr_employees(organization_id,employee_number,first_name,last_name,hire_date,base_salary) values($1,'EMP2','Synthetic','Second',current_date,20000)",[ids.org]);
 const period=await one("insert into hr_payroll_periods(organization_id,period_number,month,year,period_start,period_end) values($1,'PAY-202611',11,2026,'2026-11-01','2026-11-30') returning id",[ids.org]);
 const periodStamp=async()=>(await one('select updated_at::text value from hr_payroll_periods where id=$1',[period.id])).value;
 const prepare=async(version,ack=true)=>(await one('select prepare_hr_payroll_atomic($1,$2,$3,$4) value',[ids.org,period.id,version,ack])).value;
 phase='payroll';
 await rejected(()=>prepare(null),/PAYROLL_PERIOD_CHANGED/,'Payroll missing version refused');
 await rejected(async()=>prepare(await periodStamp(),false),/PAYROLL_BASE_ONLY_ACK_REQUIRED/,'Base-only acknowledgement required');
 await rejected(async()=>prepare(await periodStamp()),/PAYROLL_SETTINGS_REQUIRED/,'Missing settings cannot become gross equals net');
 await db.query("insert into hr_settings(organization_id) values($1)",[ids.org]);await rejected(async()=>prepare(await periodStamp()),/PAYROLL_SETTINGS_REQUIRED/,'Seed-like empty settings refuse');
 await db.query("update hr_settings set cnss_employee_rate=4,cnss_employer_rate=10,amo_employee_rate=2,amo_employer_rate=3,cnss_monthly_ceiling=6000,ir_brackets='[{\"from\":0,\"to\":null,\"rate\":10,\"deduction\":100}]' where organization_id=$1",[ids.org]);
 for(const bad of ['NaN','Infinity','-Infinity']){
  await db.exec('savepoint bad_setting');await db.query("update hr_settings set ir_brackets=jsonb_build_array(jsonb_build_object('from',0,'to',null,'rate',10,'deduction',$2::text)) where organization_id=$1",[ids.org,bad]);
  await rejected(async()=>prepare(await periodStamp()),/PAYROLL_SETTINGS_REQUIRED/,'Nonfinite IR deduction refused '+bad);await db.exec('rollback to bad_setting;release bad_setting');
  await rejected(async()=>{await db.query("update hr_settings set cnss_monthly_ceiling=$2::numeric where organization_id=$1",[ids.org,bad]);await prepare(await periodStamp());},/PAYROLL_SETTINGS_REQUIRED|overflow|out of range/,'Nonfinite CNSS ceiling refused '+bad);
 }
 const oldVersion=await periodStamp();const prepared=await prepare(oldVersion);equal(Number(prepared.total_net),26228,'Independent synthetic net8704+17524 for two salaries');equal(Number(prepared.total_employer_cost),32100,'Independent employer cost10900+21200');
 equal(prepared.scope,'base_only_preparatory','Scope cannot claim final payroll');
 const slip=await one('select * from hr_payslips where payroll_period_id=$1',[period.id]);equal(slip.calculation_details.variablesIncluded,false,'Variables explicitly excluded');equal(slip.calculation_details.officialConformityClaim,false,'No official conformity claim');
 await rejected(()=>prepare(oldVersion),/PAYROLL_PERIOD_CHANGED/,'Second stale payroll request refuses');
 const before=JSON.stringify({period:await one('select * from hr_payroll_periods where id=$1',[period.id]),slips:(await db.query('select * from hr_payslips where payroll_period_id=$1 order by id',[period.id])).rows});
 await as(null);await db.exec('reset role');await db.exec("create function public.audit_fail_period() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_FINAL_WRITE_FAILURE';end $$; create trigger zzz_audit_failure before update on hr_payroll_periods for each row execute function public.audit_fail_period();");await as(ids.admin);
 await rejected(async()=>prepare(await periodStamp()),/SYNTHETIC_FINAL_WRITE_FAILURE/,'Final period error rolls back whole payroll RPC');
 equal(JSON.stringify({period:await one('select * from hr_payroll_periods where id=$1',[period.id]),slips:(await db.query('select * from hr_payslips where payroll_period_id=$1 order by id',[period.id])).rows}),before,'Exact payslips and period preserved after final write failure');
 await as(null);await db.exec('reset role;drop trigger zzz_audit_failure on hr_payroll_periods;drop function audit_fail_period();');await as(ids.admin);
 await rejected(()=>db.query("update hr_payroll_periods set status='paid' where id=$1",[period.id]),/PAYROLL_PREPARATORY_ONLY/,'Final payroll payment blocked');
 await rejected(()=>db.query("update hr_payslips set status='validated' where id=$1",[slip.id]),/PAYROLL_PREPARATORY_ONLY/,'Final payslip validation blocked');
 await rejected(()=>db.query("update hr_employees set base_salary=-1 where id=$1",[employee.id]),/hr_employee_salary_valid_106/,'Database salary guard refuses negative');
 await rejected(()=>db.query("update hr_employees set base_salary='NaN' where id=$1",[employee.id]),/hr_employee_salary_valid_106/,'Database salary guard refuses NaN');
 for(const user of [ids.viewer,ids.operator,ids.outsider]){await as(user);await rejected(()=>save('quote'),/PRO_WRITE_ROLE_REQUIRED|SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'Unauthorized commercial role refused '+user);await rejected(()=>prepare(null),/HR_MANAGEMENT_REQUIRED|SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'Unauthorized payroll role refused '+user);}
 await as(null,'anon');await rejected(()=>save('quote'),/permission denied/,'Anonymous RPC execute denied');
 await as(null);await db.exec('reset role');await db.query("update organization_subscriptions set current_period_end=now()-interval '1 day' where organization_id=$1",[ids.org]);await as(ids.admin);await rejected(()=>save('quote'),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription denies commercial');await rejected(()=>prepare(null),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription denies payroll');
 await as(null);await db.exec('reset role');await db.query("update organization_subscriptions set current_period_end=now()+interval '1 month',plan_code='essentiel' where organization_id=$1",[ids.org]);await as(ids.admin);await rejected(()=>save('quote'),/PRO_PLAN_REQUIRED/,'ESSENTIEL cannot call commercial PRO');await rejected(()=>prepare(null),/PRO_PLAN_REQUIRED/,'ESSENTIEL cannot call payroll PRO');
 await db.exec('rollback;reset role');equal(Number((await one('select count(*) n from organizations where id=$1',[ids.org])).n),0,'All synthetic business rows rolled back');
 await writeFile(output,JSON.stringify({passed:true,checks,results,engine,scope:'Actual105/106 and104/099 guards in disposable PGlite. Historical accounting stubs and Auth simulated; no hosted API. Stale serial requests tested, not true multi-connection concurrency.',businessRowsRolledBack:true},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,output}));
}catch(error){console.error(JSON.stringify({passed:false,phase,checks,message:error.message,code:error.code,detail:error.detail,where:error.where}));process.exitCode=1;}finally{await db.close();}
`;
const folder=await mkdtemp(join(tmpdir(),'felexia-pro-transactions-'));const runner=join(folder,'runner.mjs');
try{await writeFile(runner,source);await import(pathToFileURL(runner).href);}finally{await rm(runner,{force:true});await rmdir(folder);}
