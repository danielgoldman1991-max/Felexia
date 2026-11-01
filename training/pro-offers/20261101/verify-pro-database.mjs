// Real SQL in disposable PostgreSQL/PGlite. No .env, network or production.
import { readFile, writeFile, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

if (!process.argv.some(a => a.startsWith('--pglite-root=')) || process.argv.some(a => a.startsWith('--postgres-url='))) throw Error('Explicit disposable PGlite package path required');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = fileURLToPath(new URL(process.argv.includes('--relaxed-v3') ? 'database-relaxed.json' : 'database-strict.json', import.meta.url));
const baseline = (await readFile(join(root, 'training/essential-fixes/20261031/verify-subscription-access.mjs'), 'utf8')).replace(/\r\n/g, '\n');
const marker = '\ntry {\n  await bootstrap();';
if (!baseline.includes(marker)) throw Error('Review changed subscription test bootstrap');
let source = baseline.slice(0, baseline.indexOf(marker));
source = source.replace('new URL(`../../../supabase/migrations/${file}`, import.meta.url)', 'new URL(file,' + JSON.stringify(pathToFileURL(join(root, 'supabase/migrations/')).href) + ')');
source += '\nconst proofOutput=' + JSON.stringify(output) + ';\n';
source += '\nconst rollbackPath=' + JSON.stringify(join(root, 'supabase/rollback/104_pro_erp_write_access.sql')) + ';\n';
source += String.raw`
try {
  await bootstrap();
  await db.exec("do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;");
  await db.exec("create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; create policy synthetic_storage_all on storage.objects for all to authenticated using(true) with check(true); grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;");
  for (const file of ['082_hr_module.sql','065_create_documents_module.sql','080_create_vat_declarations.sql','081_fix_vat_declarations_rls.sql','090_treasury_forecast_items.sql']) await db.exec(await sql(file));
  await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
  await db.exec((await sql('099_essential_subscription_access.sql')));
  await db.exec('begin');
  for (const [org,label] of [[ids.org,'PRO isolated QA'],[ids.foreign,'Foreign isolated QA']]) await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[org,label]);
  for (const [user,name] of [[ids.admin,'admin'],[ids.viewer,'viewer'],[ids.operator,'operator'],[ids.accountant,'accountant']]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@example.test']);
    await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@example.test']);
    const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[ids.org,name]);
    await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[ids.org,user,role.id]);
  }
  await as(ids.admin);
  await db.query('select ensure_essential_trial($1)',[ids.org]);
  const legacy=await one("insert into hr_departments(organization_id,name) values($1,'Historical department') returning id",[ids.org]);
  const customer=await one("insert into third_parties(organization_id,primary_type,types,name,code) values($1,'customer',array['customer'],'Synthetic customer','CUSTOMER-QA') returning id",[ids.org]);
  await as(null); await db.exec('reset role');
  const migration=(await sql('104_pro_erp_write_access.sql')).replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
  await db.exec(migration); await db.exec(migration);
  equal(Number((await one("select count(*) n from pg_trigger where tgname='aa_pro_erp_write_guard' and not tgisinternal")).n)>30,true,'104 installs on real HR, stock, sales, purchase, VAT and treasury tables and reinstalls');
  await as(ids.admin);
  const caps=await one('select erp_get_capabilities($1) capabilities',[ids.org]);
  equal(caps.capabilities,{workflow_version:104,pro_write_guards:true},'Authenticated company receives installed PRO capability');
  await rejected(()=>db.query('select erp_get_capabilities($1)',[ids.foreign]),/SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'No capability for foreign company');
  await as(null,'anon');
  await rejected(()=>db.query('select erp_get_capabilities($1)',[ids.org]),/permission denied/,'Anonymous cannot call capability');
  await as(null,'service_role');
  await rejected(()=>db.query('select erp_get_capabilities($1)',[ids.org]),/permission denied/,'Default service privileges explicitly revoked from capability');
  await as(ids.admin);
  for (const [label,query,args] of [
    ['RH',"insert into hr_departments(organization_id,name) values($1,'Blocked')",[ids.org]],
    ['warehouse',"insert into warehouses(organization_id,name,code) values($1,'Blocked','BLOCKED')",[ids.org]],
    ['GED',"insert into documents(organization_id,name,document_type) values($1,'Blocked','other')",[ids.org]],
    ['quote',"insert into sales_documents(organization_id,document_type,document_number,customer_id) values($1,'quote','BLOCKED',$2)",[ids.org,customer.id]],
    ['VAT declaration',"insert into vat_declarations(organization_id,declaration_number,period_start,period_end) values($1,'BLOCKED',current_date,current_date)",[ids.org]],
  ]) await rejected(()=>db.query(query,args),/PRO_PLAN_REQUIRED/,'Essentiel cannot write '+label+' directly');
  equal((await one('select name from hr_departments where id=$1',[legacy.id])).name,'Historical department','Historical advanced rows remain readable on Essentiel');
  await db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'ESSENTIAL-QA',current_date)",[ids.org,customer.id]);
  equal(Number((await one('select get_commercial_document_usage($1) n',[ids.org])).n),1,'Essentiel invoice creation and real usage remain available');
  for (const bucket of ['organization-documents','hr-documents','tax-exports']) await rejected(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,'organizations/'+ids.org+'/blocked.pdf']),/row-level security/,'Essentiel storage write denied for '+bucket);
  await db.query("insert into storage.objects(bucket_id,name) values('unrelated-bucket','ordinary')");
  equal(Number((await one("select count(*) n from storage.objects where bucket_id='unrelated-bucket'")).n),1,'Unrelated Storage bucket policy retains previous behavior');
  await as(null); await db.exec('reset role');
  await db.query("update organization_subscriptions set plan_code='premium',plan_id=(select id from subscription_plans where code='premium'),status='active',current_period_end=now()+interval '1 month' where organization_id=$1",[ids.org]);
  await as(ids.admin);
  const department=await one("insert into hr_departments(organization_id,name) values($1,'PRO department') returning id",[ids.org]);
  const warehouse=await one("insert into warehouses(organization_id,name,code) values($1,'PRO warehouse','PRO-QA') returning id",[ids.org]);
  const document=await one("insert into documents(organization_id,name,document_type) values($1,'PRO document','other') returning id",[ids.org]);
  const vat=await one("insert into vat_declarations(organization_id,declaration_number,period_start,period_end) values($1,'PRO-VAT',current_date,current_date) returning id",[ids.org]);
  equal(!!(department.id&&warehouse.id&&document.id&&vat.id),true,'Active PRO can create HR, stock, GED and VAT records');
  const quote=await one("insert into sales_documents(organization_id,document_type,document_number,customer_id) values($1,'quote','PRO-QA',$2) returning id",[ids.org,customer.id]);
  equal(!!quote.id,true,'Active PRO can create a quote');
  for (const bucket of ['organization-documents','hr-documents','tax-exports']) await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,'organizations/'+ids.org+'/allowed.pdf']);
  equal(Number((await one("select count(*) n from storage.objects where bucket_id<>'unrelated-bucket'")).n),3,'Active PRO can upload to the three protected buckets');
  await rejected(()=>db.query("insert into storage.objects(bucket_id,name) values('hr-documents','invalid-path')"),/row-level security/,'Malformed HR Storage path denied');
  await rejected(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['hr-documents','organizations/'+ids.foreign+'/forbidden.pdf']),/row-level security/,'Foreign company Storage upload denied');
  await as(null); await db.exec('reset role');
  await db.exec("create function public.synthetic_pro_definer(p_org uuid) returns void language plpgsql security definer set search_path=public as $$ begin insert into hr_departments(organization_id,name) values(p_org,'Definer bypass attempt'); end $$; grant execute on function public.synthetic_pro_definer(uuid) to authenticated;");
  await db.query("update organization_subscriptions set status='canceled' where organization_id=$1",[ids.org]);
  await as(ids.admin);
  await rejected(()=>db.query('select synthetic_pro_definer($1)',[ids.org]),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired PRO cannot bypass guard through SECURITY DEFINER RPC');
  await rejected(()=>db.query("update hr_departments set name='Forbidden' where id=$1",[department.id]),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired PRO cannot modify RH');
  await rejected(()=>db.query("insert into warehouses(organization_id,name,code) values($1,'Expired','EXPIRED')",[ids.org]),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired PRO cannot create stock location');
  await rejected(()=>db.query("insert into storage.objects(bucket_id,name) values($1,$2)",['organization-documents','organizations/'+ids.org+'/expired.pdf']),/row-level security/,'Expired PRO cannot upload');
  equal((await one('select id from documents where id=$1',[document.id])).id,document.id,'Expired PRO preserves GED reads');
  equal((await one('select erp_get_capabilities($1) c',[ids.org])).c.pro_write_guards,true,'Expired PRO preserves capability read');
  equal(Number((await one("select count(*) n from storage.objects where bucket_id='hr-documents'")).n),1,'Expired PRO preserves existing Storage read policies');
  await as(null); await db.exec('reset role');
  await db.query("update organization_subscriptions set status='active',current_period_end=now()+interval '1 month' where organization_id=$1",[ids.org]);
  await db.query("insert into commercial_document_usage(organization_id,document_table,document_id) select $1,'synthetic',gen_random_uuid() from generate_series(1,600)",[ids.org]);
  await as(ids.admin);
  await db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'PRO-BEYOND-500',current_date)",[ids.org,customer.id]);
  equal(Number((await one('select get_commercial_document_usage($1) n',[ids.org])).n)>500,true,'Durable premium PRO has unlimited commercial quota beyond 500');
  const plan=await one("select max_users,max_documents_per_month from subscription_plans where code='premium'");
  equal(plan.max_users,25,'PRO retains 25-user SQL plan limit');
  equal(plan.max_documents_per_month,null,'PRO retains unlimited-document SQL plan limit');
  await as(ids.viewer);
  await rejected(()=>db.query('select synthetic_pro_definer($1)',[ids.org]),/PRO_WRITE_ROLE_REQUIRED/,'PRO viewer cannot bypass RH writes through definer RPC');
  equal((await one('select id from hr_departments where id=$1',[department.id])).id,department.id,'PRO viewer retains HR reads');
  await as(ids.operator);
  await rejected(()=>db.query('select synthetic_pro_definer($1)',[ids.org]),/PRO_WRITE_ROLE_REQUIRED/,'PRO operator cannot bypass RH writes through definer RPC');
  await as(ids.accountant);
  equal(!!(await one("insert into hr_departments(organization_id,name) values($1,'Accountant permitted') returning id",[ids.org])).id,true,'Existing accountant RH management permission remains');
  await as(null); await db.exec('reset role');
  await db.exec("create table public.synthetic_stock_source(id uuid primary key default gen_random_uuid(),organization_id uuid,code text); grant insert,select on public.synthetic_stock_source to authenticated; create function public.synthetic_stock_trigger() returns trigger language plpgsql security invoker as $$ begin insert into warehouses(organization_id,name,code) values(new.organization_id,'Automatic admitted stock',new.code); return new; end $$; create trigger synthetic_stock_nested after insert on public.synthetic_stock_source for each row execute function synthetic_stock_trigger();");
  await db.query("update organization_subscriptions set plan_code='essentiel',plan_id=(select id from subscription_plans where code='essentiel') where organization_id=$1",[ids.org]);
  await as(ids.admin);
  await db.query("insert into synthetic_stock_source(organization_id,code) values($1,'NESTED-ESSENTIAL')",[ids.org]);
  equal(Number((await one("select count(*) n from warehouses where code='NESTED-ESSENTIAL'")).n),1,'Nested automatic stock from an admitted Essentiel operation is preserved');
  await rejected(()=>db.query('select synthetic_pro_definer($1)',[ids.org]),/PRO_PLAN_REQUIRED/,'Essentiel cannot bypass PRO plan through definer RPC');
  await as(null); await db.exec('reset role');
  await db.query("update organization_subscriptions set status='canceled' where organization_id=$1",[ids.org]);
  await as(ids.admin);
  await rejected(()=>db.query("insert into synthetic_stock_source(organization_id,code) values($1,'NESTED-EXPIRED')",[ids.org]),/SUBSCRIPTION_WRITE_REQUIRED/,'Nested stock cannot bypass subscription expiry');
  await as(null); await db.exec('reset role');
  const departmentCount=Number((await one('select count(*) n from hr_departments where organization_id=$1',[ids.org])).n);
  const rollback=(await readFile(rollbackPath,'utf8')).replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
  await db.exec(rollback); await db.exec(rollback);
  equal(Number((await one("select count(*) n from pg_trigger where tgname='aa_pro_erp_write_guard'")).n),0,'Manual rollback removes only the PRO triggers and is idempotent');
  equal((await one("select to_regprocedure('public.erp_get_capabilities(uuid)') cap")).cap,null,'Manual rollback removes the capability');
  equal(Number((await one("select count(*) n from pg_trigger where tgname='aa_essential_subscription_guard'")).n)>0,true,'Manual rollback preserves 099 subscription triggers');
  equal(Number((await one('select count(*) n from hr_departments where organization_id=$1',[ids.org])).n),departmentCount,'Manual rollback preserves existing business records');
  await db.exec(migration);
  equal(Number((await one("select count(*) n from pg_trigger where tgname='aa_pro_erp_write_guard'")).n)>30,true,'104 can be reinstalled after its manual rollback');
  await db.exec('rollback');
  equal(Number((await one('select count(*) n from organizations where id=$1',[ids.org])).n),0,'All business fixture changes rolled back');
  await writeFile(proofOutput,JSON.stringify({passed:true,date:new Date().toISOString(),checks,results,engine,relaxedV3:process.argv.includes('--relaxed-v3'),scope:'Disposable PostgreSQL, real migrations 082/099/104; no production data or credentials',fixtureRollbackVerified:true},null,2)+'\n');
  console.log(JSON.stringify({passed:true,checks,output:proofOutput}));
} catch(error) { console.error(JSON.stringify({passed:false,checks,phase,message:error.message,code:error.code,detail:error.detail,where:error.where})); process.exitCode=1; } finally {await db.close();}
`;
const folder = await mkdtemp(join(tmpdir(), 'felexia-pro-database-'));
const runtime = join(folder, 'verify.mjs');
try { await writeFile(runtime, source); await import(pathToFileURL(runtime).href); }
finally { await rm(runtime, { force: true }); await rmdir(folder); }
