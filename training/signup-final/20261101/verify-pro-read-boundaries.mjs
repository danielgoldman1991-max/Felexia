// Disposable PostgreSQL only. No .env, hosted endpoint, account or business data.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

if (!process.argv.some(arg => arg.startsWith('--pglite-root=')) || process.argv.some(arg => /--(?:postgres-url|pg-root)=/.test(arg))) {
  throw Error('Explicit disposable PGlite package directory required; native/network targets refused');
}
const baseline = (await readFile(new URL('../../essential-fixes/20261031/verify-subscription-access.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const marker = '\ntry {\n  await bootstrap();';
if (baseline.split(marker).length !== 2) throw Error('Review changed disposable099 bootstrap');
const migration = await readFile(new URL('../../../supabase/migrations/110_pro_read_boundaries.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../../supabase/rollback/110_pro_read_boundaries.sql', import.meta.url), 'utf8');
let source = baseline.slice(0, baseline.indexOf(marker));
source += '\nconst migration110=' + JSON.stringify(migration) + ';\nconst rollback110=' + JSON.stringify(rollback) + ';\n';
source += 'const migrationSha=' + JSON.stringify(createHash('sha256').update(migration).digest('hex')) + ';\n';
source += 'const proofOutput=' + JSON.stringify(fileURLToPath(new URL(process.argv.includes('--relaxed-v3') ? 'pro-read-relaxed.json' : 'pro-read-strict.json', import.meta.url))) + ';\n';
source += String.raw`
const orgs={ess:ids.org,pro:ids.foreign,business:'10000000-0000-4000-8000-000000001110',none:'10000000-0000-4000-8000-000000001111'};
const owner=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
const count=async(table,organization)=>Number((await one('select count(*) n from public.'+table+' where organization_id=$1',[organization])).n);
const proTables=['hr_departments','hr_employees','documents','sales_documents','sales_document_lines','purchase_documents','warehouses','stock_levels'];
const sharedTables=['customer_invoices','supplier_invoices','accounting_journals','accounting_entries','accounting_accounts','treasury_accounts'];
const originalCatalog=()=>one("select jsonb_build_object('functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app_private') and p.proname not in('can_read_pro_erp_110','can_read_pro_storage_110')),'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polname not in('pro_read_guard_110','pro_storage_read_guard_110')),'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t),'relations',(select jsonb_agg(jsonb_build_object('oid',c.oid,'acl',c.relacl,'owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','storage') and c.relkind in('r','p'))) data");
async function snapshot(){const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in('public','storage') order by schemaname,tablename")).rows;const data={};for(const t of tables)data[t.schemaname+'.'+t.tablename]=(await one('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),\'[]\'::jsonb) rows from '+t.schemaname+'.'+t.tablename+' r')).rows;return JSON.stringify(data);}
async function checkDirect(organization,expected,label){for(const table of proTables)equal(await count(table,organization),expected,label+' '+table);}
async function checkShared(organization,label){for(const table of sharedTables)equal(await count(table,organization),1,label+' '+table);}
async function install(sqlText){return db.exec(sqlText);}
async function storageNames(bucket){return(await db.query('select name from storage.objects where bucket_id=$1 order by name',[bucket])).rows.map(r=>r.name);}
const readObjects=()=>one("select jsonb_build_object('helpers',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in('can_read_pro_erp_110','can_read_pro_storage_110')),'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polname in('pro_read_guard_110','pro_storage_read_guard_110'))) data");
async function atomicRefusal(sqlText,pattern,label){const data=await snapshot(),objects=await readObjects(),catalog=await originalCatalog();let error;try{await install(sqlText);}catch(caught){error=caught;}if(error)await db.exec('rollback');equal(Boolean(error&&pattern.test(error.message)),true,label+' refuses the unexpected state');equal(await snapshot(),data,label+' leaves all business rows exact');equal(await readObjects(),objects,label+' preserves the unexpected preexisting read objects atomically');equal(await originalCatalog(),catalog,label+' preserves all original ACL functions policies and triggers');}
try{
 await bootstrap();
 await db.exec("do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;");
 await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;create policy unrelated_storage_fixture on storage.objects for select to authenticated using(bucket_id='unrelated-bucket');");
 for(const file of ['082_hr_module.sql','065_create_documents_module.sql','066_fix_documents_module_functional.sql','073_dgi_vat_xml_preparatory.sql','080_create_vat_declarations.sql','081_fix_vat_declarations_rls.sql','090_treasury_forecast_items.sql'])await db.exec(await sql(file));
 await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;grant select on all tables in schema public to anon;');
 await db.exec(await sql('099_essential_subscription_access.sql'));
 phase='synthetic tenants';
 for(const[name,id]of Object.entries(orgs))await db.query('insert into organizations(id,name,slug) values($1,$2,$3)',[id,'Read110 '+name,'read110-'+name]);
 for(const[user,name]of [[ids.admin,'ess'],[ids.owner,'pro'],[ids.viewer,'viewer'],[ids.inactive,'inactive'],[ids.outsider,'outsider'],[ids.operator,'business'],[ids.noMember,'none']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@read110.invalid']);
  await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@read110.invalid']);
 }
 for(const[user,org,roleName,status]of [[ids.admin,orgs.ess,'admin','active'],[ids.owner,orgs.pro,'admin','active'],[ids.viewer,orgs.pro,'viewer','active'],[ids.inactive,orgs.pro,'admin','disabled'],[ids.operator,orgs.business,'admin','active'],[ids.noMember,orgs.none,'admin','active']]){
  const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[org,roleName]);
  await db.query('insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)',[org,user,role.id,status]);
 }
 for(const[org,plan]of [[orgs.ess,'essentiel'],[orgs.pro,'premium'],[orgs.business,'business']])await db.query("insert into organization_subscriptions(organization_id,plan_id,plan_code,status,billing_cycle,billing_interval,trial_start,trial_started_at,trial_end,trial_ends_at,current_period_start,current_period_end) select $1,id,$2,'trialing','monthly','monthly',now(),now(),now()+interval '15 days',now()+interval '15 days',now(),now()+interval '15 days' from subscription_plans where code=$2",[org,plan]);
 phase='real table fixtures';
 for(const[name,org]of Object.entries(orgs)){
  const third=await one("insert into third_parties(organization_id,primary_type,types,name,code) values($1,'customer',array['customer','supplier'],$2,$3) returning id",[org,'Read110 '+name,'READ110-'+name]);
  const warehouse=await one("insert into warehouses(organization_id,name,code) values($1,'Read110 warehouse',$2) returning id",[org,'WH-'+name]);
  const product=await one("insert into products(organization_id,sku,name,type,track_stock,current_stock) values($1,$2,'Read110 product','product',true,0) returning id",[org,'SKU-'+name]);
  await db.query('insert into stock_levels(organization_id,warehouse_id,product_id,quantity) values($1,$2,$3,1)',[org,warehouse.id,product.id]);
  await db.query("insert into hr_departments(organization_id,name) values($1,'Read110 department')",[org]);
  await db.query("insert into hr_employees(organization_id,employee_number,first_name,last_name,hire_date) values($1,'EMP110','Synthetic','Employee',current_date)",[org]);
  await db.query("insert into documents(organization_id,name,document_type) values($1,'Read110 document','other')",[org]);
  const quote=await one("insert into sales_documents(organization_id,document_type,document_number,customer_id) values($1,'quote',$2,$3) returning id",[org,'QUOTE-'+name,third.id]);
  await db.query("insert into sales_document_lines(organization_id,document_id,description) values($1,$2,'Read110 quote line')",[org,quote.id]);
  await db.query("insert into purchase_documents(organization_id,document_type,document_number,supplier_id) values($1,'supplier_order',$2,$3)",[org,'PO-'+name,third.id]);
  await db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,$3,current_date)",[org,third.id,'CI-'+name]);
  await db.query("insert into supplier_invoices(organization_id,supplier_id,invoice_number,invoice_date) values($1,$2,$3,current_date)",[org,third.id,'SI-'+name]);
  const journal=await one("insert into accounting_journals(organization_id,code,name) values($1,'READ110','Read110 journal') returning id",[org]);
  await db.query("insert into accounting_entries(organization_id,journal_id,entry_number) values($1,$2,'ENTRY110')",[org,journal.id]);
  await db.query("insert into accounting_accounts(organization_id,notes) values($1,'Read110 account')",[org]);
  await db.query("insert into treasury_accounts(organization_id,name,account_type) values($1,'Read110 bank','bank')",[org]);
  for(const bucket of ['organization-documents','hr-documents','tax-exports']){
   await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,'organizations/'+org+'/files/synthetic.pdf']);
   if(bucket!=='tax-exports')await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,org+'/files/legacy.pdf']);
  }
 }
 for(const bucket of ['organization-documents','hr-documents','tax-exports'])for(const name of ['invalid-path','organizations/not-a-uuid/file.pdf','organizations/'+orgs.pro+'/../escape.pdf','organizations/'+orgs.pro+'/./file.pdf','organizations/'+orgs.pro+'/','organizations/'+orgs.pro])await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,name]);
 await db.query("insert into storage.objects(bucket_id,name) values('unrelated-bucket','ordinary')");
 await db.exec(await sql('104_pro_erp_write_access.sql'));
 // Modeled admitted ESSENTIEL business trigger: no arbitrary trigger creation is
 // granted to application users. It tests the existing stock invoker dependency.
 await db.exec("create table public.read110_internal_probe(id uuid primary key default gen_random_uuid(),organization_id uuid,seen bigint);grant insert,select on read110_internal_probe to authenticated;create function public.read110_internal_stock_probe() returns trigger language plpgsql security invoker set search_path=public as $$ begin select count(*) into new.seen from warehouses where organization_id=new.organization_id;return new;end $$;create trigger read110_probe before insert on read110_internal_probe for each row execute function read110_internal_stock_probe();");
 phase='demonstrate old read gap';
 await as(ids.admin);await checkDirect(orgs.ess,1,'Before110 ESS can read its own advanced');
 equal((await storageNames('organization-documents')).length>2,true,'Before110 broad GED storage policy exposes other tenant paths');
 equal((await storageNames('hr-documents')).length>2,true,'Before110 broad HR storage policy exposes other tenant paths');
 equal((await storageNames('tax-exports')).some(name=>name.startsWith('organizations/'+orgs.ess+'/')),true,'Before110 tax export policy permits own canonical prefix');
 equal((await storageNames('tax-exports')).some(name=>name.startsWith('organizations/'+orgs.pro+'/')),false,'Before110 tax export policy already excludes another tenant');
 await owner();
 const beforeData=await snapshot(),beforeCatalog=await originalCatalog();
 phase='install110';await install(migration110);
 equal(await snapshot(),beforeData,'110 installation does not modify any public or Storage business row');
 equal(await originalCatalog(),beforeCatalog,'110 preserves all existing functions ACL config triggers relations and policies');
 const expectedPolicies=Number((await one("select count(*) n from pg_trigger where tgname='aa_pro_erp_write_guard' and not tgisinternal")).n);
 equal(Number((await one("select count(*) n from pg_policy where polname='pro_read_guard_110' and not polpermissive and polcmd='r'")).n),expectedPolicies,'Every existing104 advanced table receives a restrictive SELECT-only policy');
 equal(Number((await one("select count(*) n from pg_policy where polname='pro_storage_read_guard_110' and not polpermissive and polcmd='r'")).n),1,'Storage receives one restrictive SELECT-only guard');
 equal((await one("select exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid where p.polname='pro_read_guard_110' and c.relname=any($1::text[])) bad",[sharedTables])).bad,false,'No new PRO guard is installed on ESSENTIEL shared invoice accounting or treasury tables');
 const installedPolicies=await one("select jsonb_agg(to_jsonb(p) order by oid) policies from pg_policy p where polname in('pro_read_guard_110','pro_storage_read_guard_110')");
 await install(migration110);
 equal(await one("select jsonb_agg(to_jsonb(p) order by oid) policies from pg_policy p where polname in('pro_read_guard_110','pro_storage_read_guard_110')"),installedPolicies,'110 reapplication preserves exact installed policies and OIDs');
 equal(await snapshot(),beforeData,'110 reapplication does not change business data');
 phase='ESS and role boundaries';
 await as(ids.admin);await checkDirect(orgs.ess,0,'ESS cannot directly read own advanced');await checkDirect(orgs.pro,0,'ESS cannot read another tenant advanced');await checkShared(orgs.ess,'ESS shared data preserved');
 equal((await one('select app_private.can_read_pro_erp_110($1) allowed',[orgs.ess])).allowed,false,'ESS helper does not acquire PRO by active trial');
 for(const bucket of ['organization-documents','hr-documents','tax-exports'])equal(await storageNames(bucket),[],'ESS cannot list protected Storage bucket '+bucket);
 equal(await storageNames('unrelated-bucket'),['ordinary'],'Unrelated bucket read policy stays effective');
 const internal=await one('insert into read110_internal_probe(organization_id) values($1) returning seen',[orgs.ess]);equal(Number(internal.seen),1,'Admitted ESS stock invoker trigger still sees own warehouse internally');
 equal(await count('warehouses',orgs.ess),0,'After trigger returns ESS still cannot directly read warehouses');
 for(const[user,org,label]of [[ids.operator,orgs.business,'Business legacy'],[ids.noMember,orgs.none,'No subscription'],[ids.inactive,orgs.pro,'Inactive membership'],[ids.outsider,orgs.pro,'No membership']]){
  await as(user);equal((await one('select app_private.can_read_pro_erp_110($1) allowed',[org])).allowed,false,label+' cannot obtain PRO helper access');await checkDirect(org,0,label+' advanced data denied');
 }
 await as(null);await checkDirect(orgs.pro,0,'Authenticated without uid denied');for(const bucket of ['organization-documents','hr-documents','tax-exports'])equal(await storageNames(bucket),[],'Missing uid Storage denied '+bucket);
 await as(null,'anon');await checkDirect(orgs.pro,0,'Anonymous advanced SELECT denied');
 phase='PRO positive reads and expiry';
 for(const user of [ids.owner,ids.viewer]){
  await as(user);await checkDirect(orgs.pro,1,(user===ids.owner?'PRO admin':'PRO viewer')+' own advanced visible');await checkDirect(orgs.ess,0,'PRO cross-tenant advanced denied');await checkShared(orgs.pro,'PRO shared data preserved');
  for(const bucket of ['organization-documents','hr-documents'])equal(await storageNames(bucket),[orgs.pro+'/files/legacy.pdf','organizations/'+orgs.pro+'/files/synthetic.pdf'].sort(),'PRO only own canonical and legacy paths '+bucket);
  equal(await storageNames('tax-exports'),['organizations/'+orgs.pro+'/files/synthetic.pdf'],'PRO tax exports retain canonical tenant restriction and reject invalid paths');
 }
 await owner();await db.query("update organization_subscriptions set status='canceled',trial_end=now()-interval '1 day',trial_ends_at=now()-interval '1 day',current_period_end=now()-interval '1 day' where organization_id=$1",[orgs.pro]);
 await as(ids.owner);await checkDirect(orgs.pro,1,'Expired PRO retains existing advanced records');
 equal((await storageNames('hr-documents')).length,2,'Expired PRO retains only its own HR Storage reads');
 for(const path of ['',orgs.pro,'organizations/'+orgs.pro,'organizations/'+orgs.pro+'/','organizations/not-a-uuid/file','organizations/'+orgs.pro+'/../escape.pdf','organizations/'+orgs.pro+'/./file.pdf','organizations/'+orgs.ess+'/files/synthetic.pdf'])equal((await one('select app_private.can_read_pro_storage_110($1,$2) allowed',['hr-documents',path])).allowed,false,'Storage helper denies malformed/foreign path '+path);
 equal((await one('select app_private.can_read_pro_storage_110($1,$2) allowed',['unrelated-bucket','ordinary'])).allowed,true,'New helper does not restrict unrelated buckets');
 await owner();
 phase='fail closed installer and rollback';
 const frozenReadObjects=await readObjects();
 for(const variant of ['invoker','public']){
  if(variant==='invoker')await db.exec('alter function app_private.can_read_pro_erp_110(uuid) security invoker');
  else await db.exec('grant execute on function app_private.can_read_pro_erp_110(uuid) to public');
  await atomicRefusal(migration110,/PRO110_UNEXPECTED_HELPER/,'Installer helper '+variant);
  await atomicRefusal(rollback110,/PRO110_ROLLBACK_UNEXPECTED_HELPER/,'Rollback helper '+variant);
  if(variant==='invoker')await db.exec('alter function app_private.can_read_pro_erp_110(uuid) security definer');
  else await db.exec('revoke execute on function app_private.can_read_pro_erp_110(uuid) from public');
  equal(await readObjects(),frozenReadObjects,'Manual fixture repair restores exact helper metadata after '+variant);
 }
 await db.exec('alter policy pro_read_guard_110 on hr_departments using(true)');
 await atomicRefusal(migration110,/PRO110_UNEXPECTED_POLICY/,'Installer unexpected permissive expression');
 await atomicRefusal(rollback110,/PRO110_ROLLBACK_UNEXPECTED_POLICY/,'Rollback unexpected permissive expression');
 await db.exec('alter policy pro_read_guard_110 on hr_departments using(app_private.can_read_pro_erp_110(organization_id))');
 equal(await readObjects(),frozenReadObjects,'Manual fixture repair restores the exact restrictive policy expression');
 await db.exec("update storage.buckets set public=true where id='hr-documents'");
 await atomicRefusal(migration110,/PRO110_PUBLIC_BUCKET_REQUIRES_REVIEW/,'Installer unexpected public PRO bucket');
 await db.exec("update storage.buckets set public=false where id='hr-documents'");
 equal(await readObjects(),frozenReadObjects,'Public bucket refusal never changes existing read objects');
 phase='rollback preservation';const beforeRollbackData=await snapshot(),beforeRollbackCatalog=await originalCatalog();
 await install(rollback110);
 equal(Number((await one("select count(*) n from pg_policy where polname in('pro_read_guard_110','pro_storage_read_guard_110')")).n),0,'Rollback removes only110 SELECT policies');
 equal(await snapshot(),beforeRollbackData,'Rollback preserves all existing contracts documents Storage rows and business data');
 equal(await originalCatalog(),beforeRollbackCatalog,'Rollback leaves all preexisting function ACL config trigger and policy definitions exact');
 await install(rollback110);equal(await snapshot(),beforeRollbackData,'Rollback reapplication is idempotent for business data');
 await as(ids.admin);await checkDirect(orgs.ess,1,'Rollback restores previous own advanced reads');equal((await storageNames('hr-documents')).length>2,true,'Rollback restores previous Storage policy behavior');
 await owner();await install(migration110);await install(migration110);
 await writeFile(proofOutput,JSON.stringify({passed:true,checks,results,engine,relaxedV3:process.argv.includes('--relaxed-v3'),migrationSha,scope:'Actual099/104/110 and historical table/Storage policies in disposable PostgreSQL via PGlite. Accounting table bootstrap is explicit minimal legacy fixture. Internal stock admission is a synthetic SECURITY INVOKER trigger, not a complete commerce browser test. No hosted endpoint, environment secrets, real account or business data.'},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks,engine,proofOutput}));
}catch(error){console.error(JSON.stringify({passed:false,phase,checks,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}finally{await db.close();}
`;
const runtime = new URL('.pro-read-runtime-' + randomUUID() + '.mjs', import.meta.url);
try { await writeFile(runtime, source); await import(pathToFileURL(fileURLToPath(runtime)).href); }
finally { await unlink(runtime); }
