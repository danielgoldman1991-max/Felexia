// Independent adversarial extension of the disposable actual-migration harness.
// No env, hosted URL, credentials or application files are changed.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const directory = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
let source = (await readFile(join(root, 'training/launch-fixes/20261101/pro-transactions/verify-database.mjs'), 'utf8')).replace(/\r\n/g, '\n');
const installMarker = " for(const file of ['016_sales_documents_payment_terms.sql'";
if (!source.includes(installMarker)) throw Error('Review harness installation point changed');
source = source.replace(installMarker, " await db.exec('alter default privileges grant execute on functions to public,anon,authenticated,service_role;');\n" + installMarker);
source = source.replace("'106_preparatory_payroll_transactions.sql'])", "'106_preparatory_payroll_transactions.sql','107_treasury_default_account_atomic.sql'])");
const finalMarker = " await db.exec('rollback;reset role');equal(";
if (!source.includes(finalMarker)) throw Error('Review harness final rollback changed');
source = source.replace(finalMarker, String.raw`
 {
 phase='independent adversarial review';
 await as(null);await db.exec('reset role');
 await db.query("update organization_subscriptions set plan_code='premium' where organization_id=$1",[ids.org]);
 for(const signature of ['save_pro_commercial_document_atomic(uuid,uuid,text,timestamp with time zone,jsonb,jsonb)','convert_pro_quote_to_order_atomic(uuid,uuid)','prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)','pro_transaction_capabilities(uuid)','set_default_treasury_account_atomic(uuid,uuid)','save_default_treasury_account_atomic(uuid,uuid,jsonb)']){
   equal((await one('select has_function_privilege($1,$2,$3) allowed',['anon',signature,'execute'])).allowed,false,'Default public privileges cannot grant anon '+signature);
   equal((await one('select has_function_privilege($1,$2,$3) allowed',['service_role',signature,'execute'])).allowed,false,'Default service privileges cannot grant service_role '+signature);
   equal((await one('select has_function_privilege($1,$2,$3) allowed',['authenticated',signature,'execute'])).allowed,true,'Authenticated explicit grant survives '+signature);
 }
 await as(ids.admin);
 const reviewQuote=await save('quote');
 for(const deniedUser of [ids.viewer,ids.operator,ids.outsider]){
   await as(deniedUser);
   await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.org,reviewQuote]),/PRO_WRITE_ROLE_REQUIRED|SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'Conversion denies viewer/operator/nonmember independently');
 }
 await as(ids.admin);
 const reviewOrder=await save('order');
 await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.org,reviewOrder]),/PRO_DOCUMENT_NOT_FOUND/,'Conversion refuses a source order masquerading as a quote');
 await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.foreign,reviewQuote]),/SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'Conversion cannot select a foreign organization');
 const emptyQuote=await save('quote');await db.query('delete from sales_document_lines where document_id=$1',[emptyQuote]);
 await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.org,emptyQuote]),/PRO_RELATED_RECORD_INVALID/,'Conversion refuses an empty historical quote');
 const nonfiniteQuote=await save('quote');await db.query("update sales_documents set total_ttc='NaN' where id=$1",[nonfiniteQuote]);
 await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.org,nonfiniteQuote]),/PRO_INVALID_DOCUMENT/,'Conversion refuses a historical NaN header without creating an order');
 const nonfiniteLineQuote=await save('quote');await db.query("update sales_document_lines set quantity='NaN' where document_id=$1",[nonfiniteLineQuote]);
 await rejected(()=>db.query('select convert_pro_quote_to_order_atomic($1,$2)',[ids.org,nonfiniteLineQuote]),/PRO_INVALID_LINE/,'Conversion refuses a historical NaN line without creating an order');
 for(const special of ['NaN','Infinity','-Infinity']){
   await db.exec('savepoint independent_settings');
   try{
     await db.query('update hr_settings set ir_brackets=$2::jsonb where organization_id=$1',[ids.org,JSON.stringify([{from:0,to:null,rate:10,deduction:special}])]);
     await rejected(async()=>prepare(await periodStamp()),/PAYROLL_SETTINGS_REQUIRED|PAYROLL_INVALID_NET/,'IR deduction '+special+' rejected independently');
   }finally{await db.exec('rollback to savepoint independent_settings;release savepoint independent_settings');}
 }
 await db.exec('savepoint independent_ceiling');
 try{
   await db.query("update hr_settings set cnss_monthly_ceiling='NaN' where organization_id=$1",[ids.org]);
   await rejected(async()=>prepare(await periodStamp()),/PAYROLL_SETTINGS_REQUIRED|PAYROLL_INVALID_NET/,'CNSS NaN ceiling rejected independently');
 }finally{await db.exec('rollback to savepoint independent_ceiling;release savepoint independent_ceiling');}
 const unit=await one("insert into units(organization_id,name,symbol) values($1,'U','') returning id",[ids.org]);
 await rejected(()=>save('quote',null,null,[{...line,unit_id:unit.id,unit_name:'kg',quantity:1.5}]),/PRO_INDIVISIBLE_QUANTITY/,'Referenced name U with empty symbol and lying payload remains indivisible');
 const customerOnly=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Customer only','CUST-ONLY','customer',array['customer']) returning id",[ids.org]);
 await rejected(()=>save('supplier_order',null,null,[line],{...header,supplier_id:customerOnly.id}),/PRO_RELATED_RECORD_INVALID/,'Customer-only party cannot become a supplier order');
 const supplierOnly=await one("insert into third_parties(organization_id,name,code,primary_type,types) values($1,'Supplier only','SUPP-ONLY','supplier',array['supplier']) returning id",[ids.org]);
 await rejected(()=>save('quote',null,null,[line],{...header,customer_id:supplierOnly.id}),/PRO_RELATED_RECORD_INVALID/,'Supplier-only party cannot become a customer quote');
 const draft=await save('quote');const beforeDraft=await snapshot('quote',draft);
 await as(null);await db.exec('reset role');
 await db.query("update organization_members set status='disabled' where organization_id=$1 and user_id=$2",[ids.org,ids.admin]);
 await as(ids.admin);await rejected(()=>save('quote'),/SUBSCRIPTION_MEMBERSHIP_REQUIRED|PRO_WRITE_ROLE_REQUIRED/,'Inactive membership cannot invoke definer RPC');
 await as(null);await db.exec('reset role');await db.query("update organization_members set status='active' where organization_id=$1 and user_id=$2",[ids.org,ids.admin]);await as(ids.admin);
 equal(await snapshot('quote',draft),beforeDraft,'Inactive member refusal preserves existing draft');
 await as(null);await rejected(()=>save('quote'),/PRO_AUTH_REQUIRED/,'Authenticated database role without auth.uid cannot invoke definer RPC');await as(ids.admin);
 }
` + finalMarker);
source = source.replace("'database-'+(process.argv.includes", "'review-database-'+(process.argv.includes");
const runner = join(directory, '.independent-review-runner.mjs');
const migrations = ['105_pro_commercial_transactions.sql', '106_preparatory_payroll_transactions.sql', '107_treasury_default_account_atomic.sql'];
const fingerprints = Object.fromEntries(await Promise.all(migrations.map(async name => [name, createHash('sha256').update(await readFile(join(root, 'supabase/migrations', name))).digest('hex')])));
try {
  await writeFile(runner, source);
  await import(pathToFileURL(runner).href);
  if (!process.exitCode) {
    const output = join(directory, process.argv.includes('--relaxed-v3') ? 'review-database-relaxed.json' : 'review-database-strict.json');
    const report = JSON.parse(await readFile(output, 'utf8'));
    report.migrationSha256 = fingerprints;
    report.reviewIncludesNumbering097 = true;
    report.reviewDefaultPrivilegesBroadBeforeInstall = true;
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
}
finally { await unlink(runner); }
