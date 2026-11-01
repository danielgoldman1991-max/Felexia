// Reuses the reviewed 105/106 suite unchanged, adding107 to the same disposable DB.
// No gateway, Next process, environment files, cloud SQL or network.
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
if (!process.argv.some(arg => arg.startsWith('--pglite-root=')) || process.argv.some(arg => arg.includes('postgres-url'))) throw Error('Explicit disposable PGlite required');
const directory = fileURLToPath(new URL('./', import.meta.url));
const original = fileURLToPath(new URL('../pro-transactions/verify-database.mjs', import.meta.url));
const migrationNames = ['105_pro_commercial_transactions.sql', '106_preparatory_payroll_transactions.sql', '107_treasury_default_account_atomic.sql'];
const hashes = async () => Object.fromEntries(await Promise.all(migrationNames.map(async name => [name, createHash('sha256').update(await readFile(new URL('../../../../supabase/migrations/' + name, import.meta.url))).digest('hex')])));
const migrationSha256 = await hashes();
const installerMode = process.argv.includes('--installer');
const reportPrefix = installerMode ? 'installer-105-107-' : 'integrated-105-107-';
const disableRpcSqlLiteral = installerMode ? JSON.stringify(await readFile(new URL('../../../../supabase/launch-fixes-105-107-disable-rpcs.sql', import.meta.url), 'utf8')) : 'null';
let source = (await readFile(original, 'utf8')).replaceAll('\r\n', '\n');
function replaceOnce(before, after) {
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw Error('Review changed integrated suite marker: ' + before);
  source = source.replace(before, () => after);
}
replaceOnce("(process.argv.includes('--installer')?'installer-':'database-')", JSON.stringify(reportPrefix));
replaceOnce("'106_preparatory_payroll_transactions.sql']", "'106_preparatory_payroll_transactions.sql','107_treasury_default_account_atomic.sql']");
replaceOnce("await db.exec(await sql('106_preparatory_payroll_transactions.sql'));", "await db.exec(await sql('106_preparatory_payroll_transactions.sql'));await db.exec(await sql('107_treasury_default_account_atomic.sql'));");
if (installerMode) {
  replaceOnce("supabase/pro-transactions-105-106.sql", "supabase/launch-fixes-105-107.sql");
  replaceOnce("if(process.argv.includes('--installer')){phase='installer105106';await db.exec(installerSql);}", String.raw`
 phase='installer105107';
 const installSeedOrg = (await one("insert into organizations(name,slug)values('Installer preserve synthetic','installer-preserve-synthetic')returning id")).id;
 const installParty = (await one("insert into third_parties(organization_id,name,primary_type,types)values($1,'Installer party','customer',array['customer'])returning id",[installSeedOrg])).id;
 const installDoc = (await one("insert into sales_documents(organization_id,document_type,document_number,customer_id,subtotal_ht,total_ttc)values($1,'quote','INSTALLER-PRESERVE',$2,10,10)returning id",[installSeedOrg,installParty])).id;
 await db.query("insert into sales_document_lines(organization_id,document_id,description,quantity,unit_price_ht,subtotal_ht,total_ttc)values($1,$2,'Preserve existing line',1,10,10,10)",[installSeedOrg,installDoc]);
 await db.query("insert into treasury_accounts(organization_id,name,code,currency,opening_balance,current_balance,is_default)values($1,'Preserve bank','INSTALLER-BANK','MAD',55,55,true)",[installSeedOrg]);
 await db.query("insert into hr_employees(organization_id,employee_number,first_name,last_name,hire_date,base_salary)values($1,'INSTALLER-EMP','Existing','Synthetic',current_date,3210)",[installSeedOrg]);
 const installFingerprint = async()=>JSON.stringify(await Promise.all(['sales_documents','sales_document_lines','treasury_accounts','hr_employees','hr_payroll_periods','hr_payslips'].map(async table=>(await one('select md5(coalesce(jsonb_agg(to_jsonb(t)order by id)::text,\'[]\')) fingerprint from public.'+table+' t')).fingerprint)));
 const beforeInstall = await installFingerprint();
 equal((installerSql.match(/^begin;$/gm)||[]).length,1,'Installer has one BEGIN');
 equal((installerSql.match(/^commit;$/gm)||[]).length,1,'Installer has one COMMIT');
 const absentBefore = await one("select to_regprocedure('public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb)') is null and to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean)') is null and to_regprocedure('public.set_default_treasury_account_atomic(uuid,uuid)') is null absent");
 equal(absentBefore.absent,true,'Installer fixture starts before105106107');
 const faulty = installerSql.replace('-- SOURCE 107_treasury_default_account_atomic.sql',()=>"do $$begin raise exception 'INSTALLER_107_INJECTED_FAILURE';end $$;\n-- SOURCE 107_treasury_default_account_atomic.sql");
 await assert.rejects(()=>db.exec(faulty),/INSTALLER_107_INJECTED_FAILURE/);checks++;results.push('Failure at107 aborts installer after105106 creation');await db.exec('rollback');
 equal((await one("select to_regprocedure('public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb)') is null and to_regprocedure('public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean)') is null and to_regprocedure('public.set_default_treasury_account_atomic(uuid,uuid)') is null absent")).absent,true,'Failure107 rolls back all new105106107 RPCs');
 equal(Number((await one("select count(*)n from pg_trigger where tgname in('zz_pro_edit_version_105','aa_preparatory_only_106','zz_pro_edit_version_106')")).n),0,'Failure107 rolls back105106 triggers');
 equal(Number((await one("select count(*)n from pg_constraint where conname in('hr_employee_salary_valid_106','hr_contract_salary_valid_106')")).n),0,'Failure107 rolls back106 new salary constraints');
 equal((await one("select to_regprocedure('app_private.bump_pro_edit_version()') is null absent")).absent,true,'Failure107 rolls back105 private edit-version function');
 equal(await installFingerprint(),beforeInstall,'Failure107 preserves all preexisting synthetic business data');
 const installed = await db.exec(installerSql);const installationFlags = installed.at(-1).rows[0];
 equal(installationFlags,{launch_105_106_107_actif:true,pro_105_actif:true,pro_106_actif:true,treasury_107_actif:true},'Installer final readiness includes global and three individual true flags');
 equal(await installFingerprint(),beforeInstall,'Successful installation preserves preexisting synthetic business data');`);
  replaceOnce("await db.exec(await sql('105_pro_commercial_transactions.sql'));await db.exec(await sql('106_preparatory_payroll_transactions.sql'));await db.exec(await sql('107_treasury_default_account_atomic.sql'));", String.raw`
 const repeatedInstall = await db.exec(installerSql);
 equal(repeatedInstall.at(-1).rows[0],{launch_105_106_107_actif:true,pro_105_actif:true,pro_106_actif:true,treasury_107_actif:true},'Installer reapplication preserves all true readiness flags');
 equal(await installFingerprint(),beforeInstall,'Idempotent installer preserves accounts, lines, payroll and financial data exactly');
 const disableResult = await db.exec(${disableRpcSqlLiteral});
 equal(disableResult.at(-1).rows[0].launch_105_106_107_rpc_desactives,true,'Application rollback complement disables all six public RPCs');
 equal(await installFingerprint(),beforeInstall,'RPC disabling preserves all business data');
 await as(ids.admin);await assert.rejects(()=>db.query('select set_default_treasury_account_atomic($1,$2)',[installSeedOrg,installDoc]),/permission denied/);checks++;results.push('Disabled preferred-account RPC cannot execute after application rollback');
 await as(null);await db.exec('reset role');await db.exec(installerSql);
 equal((await one("select has_function_privilege('authenticated','public.set_default_treasury_account_atomic(uuid,uuid)','execute') allowed")).allowed,true,'Reapplication restores intended authenticated RPC execution');
 equal(await installFingerprint(),beforeInstall,'Re-enabling RPCs preserves all financial data');`);
}
replaceOnce("phase='commercial';", String.raw`
 phase='integrated treasury107';
 const bank107 = async(name)=>(await one('select save_default_treasury_account_atomic($1,null,$2::jsonb) id',[ids.org,JSON.stringify({name,code:name,currency:'MAD',opening_balance:50})])).id;
 const prefer107 = async(id)=>(await one('select set_default_treasury_account_atomic($1,$2) id',[ids.org,id])).id;
 const bankA107 = await bank107('BANK-INTEGRATED-A');
 const bankB107 = await bank107('BANK-INTEGRATED-B');
 equal(Number((await one('select count(*)n from treasury_accounts where organization_id=$1 and is_default',[ids.org])).n),1,'Integrated107 creates one preferred bank alongside105/106');
 equal(Number((await one('select current_balance from treasury_accounts where id=$1',[bankA107])).current_balance),50,'Integrated107 preference switch preserves balance');
 await rejected(()=>prefer107('99999999-0000-4000-8000-000000000099'),/TREASURY_ACCOUNT_NOT_FOUND/,'Integrated107 missing target refused with105/106 installed');
 equal((await one('select is_default from treasury_accounts where id=$1',[bankB107])).is_default,true,'Integrated107 missing target preserves old preference');
 phase='commercial';`);
replaceOnce("await as(null,'anon');await rejected(()=>save('quote'),/permission denied/,'Anonymous RPC execute denied');", String.raw`
 for(const user107 of [ids.viewer,ids.operator,ids.outsider]) {
   await as(user107);await rejected(()=>prefer107(bankA107),/TREASURY_ACCOUNT_WRITE_REQUIRED/,'Integrated107 viewer/operator/non-member refused '+user107);
 }
 await as(null,'anon');await rejected(()=>prefer107(bankA107),/permission denied/,'Integrated107 anonymous execution denied');
 await rejected(()=>save('quote'),/permission denied/,'Anonymous RPC execute denied');`);
replaceOnce("await as(ids.admin);await rejected(()=>save('quote'),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription denies commercial');", "await as(ids.admin);await rejected(()=>prefer107(bankA107),/SUBSCRIPTION_WRITE_REQUIRED/,'Integrated107 expired subscription refused');await rejected(()=>save('quote'),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription denies commercial');");
replaceOnce("await as(ids.admin);await rejected(()=>save('quote'),/PRO_PLAN_REQUIRED/,'ESSENTIEL cannot call commercial PRO');", "await as(ids.admin);equal(await prefer107(bankA107),bankA107,'Integrated107 remains available to valid ESSENTIEL while105/106 stay PRO');await rejected(()=>save('quote'),/PRO_PLAN_REQUIRED/,'ESSENTIEL cannot call commercial PRO');");
replaceOnce("scope:'Actual105/106 and104/099 guards in disposable PGlite. Historical accounting stubs and Auth simulated; no hosted API. Stale serial requests tested, not true multi-connection concurrency.'", "scope:'Actual105/106/107 coexisting with104/099 guards in one disposable PGlite database. Original105/106 test scenarios retained and107 bank/tenant/roles/expiry/ESSENTIEL scope added. Historical accounting schema stubs and Auth simulated; no Next or hosted API, no native multi-connection concurrency.'");
const runtime = join(directory, 'integrated-runtime-' + process.pid + '.mjs');
try {
  await writeFile(runtime, source); await import(pathToFileURL(runtime).href);
  if (process.exitCode) throw Error('Integrated suite failed');
  if (JSON.stringify(await hashes()) !== JSON.stringify(migrationSha256)) throw Error('Migrations changed during integrated verification');
  const output = join(directory, reportPrefix + (process.argv.includes('--relaxed-v3') ? 'relaxed' : 'strict') + '.json');
  const report = JSON.parse(await readFile(output, 'utf8'));
  const installerSha256 = installerMode ? createHash('sha256').update(await readFile(new URL('../../../../supabase/launch-fixes-105-107.sql', import.meta.url))).digest('hex') : undefined;
  await writeFile(output, JSON.stringify({ ...report, migrationSha256, installerSha256, checkedAt: new Date().toISOString() }, null, 2) + '\n');
}
finally { await rm(runtime, { force: true }); }
