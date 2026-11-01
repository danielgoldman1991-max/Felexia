// Reuse the existing disposable099 bootstrap. No .env or hosted URL accepted.
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const folder=fileURLToPath(new URL('./',import.meta.url));
const baseline=(await readFile(new URL('../../essential-fixes/20261031/verify-subscription-access.mjs',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const marker='\ntry {\n  await bootstrap();';
if(baseline.split(marker).length!==2)throw Error('Review changed099 bootstrap before extending it');
const migration=await readFile(new URL('../../../supabase/migrations/109_essential_trial_15_days.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../../../supabase/rollback/109_essential_trial_15_days.sql',import.meta.url),'utf8');
let source=baseline.slice(0,baseline.indexOf(marker));
source+='\nconst migration109='+JSON.stringify(migration)+';\nconst rollback109='+JSON.stringify(rollback)+';\n';
source+='const migrationSha='+JSON.stringify(createHash('sha256').update(migration).digest('hex'))+';\n';
source+='const output='+JSON.stringify(fileURLToPath(new URL((process.argv.some(arg=>arg.startsWith('--postgres-url='))?'native-':'')+(process.argv.includes('--relaxed-v3')?'database-relaxed':'database-strict')+'.json',import.meta.url)))+';\n';
source+=String.raw`
const signature='public.ensure_essential_trial(uuid)';
const oldFragment="ended := started + interval '1 month';";
const newFragment="ended := started + interval '360 hours';";
const orgs={legacy:ids.org,foreign:ids.foreign,fresh:'10000000-0000-4000-8000-000000001109',paid:'10000000-0000-4000-8000-000000001110',rolled:'10000000-0000-4000-8000-000000001111'};
const owner=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
const fn=()=>one('select to_jsonb(p) meta,pg_get_functiondef(p.oid) definition from pg_proc p where oid=to_regprocedure($1)',[signature]);
const withoutSource=meta=>Object.fromEntries(Object.entries(meta).filter(([key])=>key!=='prosrc'));
const snapshot=async()=>JSON.stringify(await one("select jsonb_build_object('contracts',(select jsonb_agg(to_jsonb(s) order by id) from organization_subscriptions s),'plans',(select jsonb_agg(to_jsonb(s) order by id) from subscription_plans s),'organizations',(select jsonb_agg(to_jsonb(s) order by id) from organizations s),'members',(select jsonb_agg(to_jsonb(s) order by id) from organization_members s)) data"));
async function denied(query,values,pattern,label){let error;try{await db.query(query,values);}catch(caught){error=caught;}equal(Boolean(error&&pattern.test(error.message)),true,label);}
async function install(sql){const response=await db.exec(sql);return response.at(-1).rows[0];}
try{
 await bootstrap();
 await db.exec("do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
 await db.exec(await sql('097_document_numbering_controls.sql'));
 await db.exec(await sql('099_essential_subscription_access.sql'));
 phase='synthetic fixtures';
 for(const [name,id] of Object.entries(orgs))await db.query('insert into organizations(id,name,slug) values($1,$2,$3)',[id,'Trial109 '+name,'trial109-'+name]);
 for(const [user,name] of [[ids.admin,'admin'],[ids.operator,'operator'],[ids.viewer,'viewer']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@trial109.invalid']);
  await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@trial109.invalid']);
  for(const organization of Object.values(orgs).filter(id=>id!==orgs.foreign)){
   const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[organization,name]);
   await db.query('insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)',[organization,user,role.id,'active']);
  }
 }
 await as(ids.admin);equal((await one('select ensure_essential_trial($1) created',[orgs.legacy])).created,true,'Original099 creates the historical trial fixture');
 await owner();
 await db.query("update organization_subscriptions set trial_started_at='2026-10-31T12:00:00Z',trial_start='2026-10-31T12:00:00Z',trial_end='2026-11-30T12:00:00Z',trial_ends_at='2026-11-30T12:00:00Z',current_period_start='2026-10-31T12:00:00Z',current_period_end='2026-11-30T12:00:00Z' where organization_id=$1",[orgs.legacy]);
 await db.query("insert into organization_subscriptions(organization_id,plan_id,plan_code,status,billing_cycle,billing_interval,current_period_start,current_period_end,monthly_amount,yearly_amount) select $1,id,'essentiel','active','monthly','monthly','2026-11-01T12:00:00Z','2026-12-01T12:00:00Z',199,1990 from subscription_plans where code='essentiel'",[orgs.paid]);
 await db.exec("create role trial109_owner bypassrls;create role trial109_extra;grant usage on schema public,auth,app_private to trial109_owner;grant select,insert,update,delete on all tables in schema public to trial109_owner;grant execute on all functions in schema app_private,auth to trial109_owner;");
 await db.exec('alter function '+signature+' owner to trial109_owner;alter function '+signature+" set statement_timeout='7s';grant execute on function "+signature+' to trial109_extra,service_role');
 const original=await fn();
 equal(original.meta.prosrc.includes(oldFragment),true,'Fixture uses the actual historical099 date expression');
 // A realistic current-price variant must be preserved rather than recopying290/2900.
 const priceVariant=original.definition.replace('false,290,2900);','false,99,1188);');
 if(priceVariant===original.definition)throw Error('Review changed099 amount fixture');
 await db.exec(priceVariant);
 const before=await fn(),dataBefore=await snapshot();
 phase='109 install';
 equal(await install(migration109),{essential_trial_109_actif:true,days:15},'109 final installer reports active=true and15days');
 const patched=await fn();
 equal(withoutSource(patched.meta),withoutSource(before.meta),'109 preserves OID signature owner ACL language volatility config and every non-source pg_proc field');
 equal(patched.meta.prosrc,before.meta.prosrc.replace(oldFragment,newFragment),'109 changes exactly one end-date expression and no other source byte');
 equal(patched.meta.prosrc.includes('false,99,1188);'),true,'109 preserves the current price variant and never restores old amounts');
 equal(await snapshot(),dataBefore,'109 installation performs no business DML across contracts plans organizations and members');
 equal(await install(migration109),{essential_trial_109_actif:true,days:15},'109 reapplication reports15days');
 equal(await fn(),patched,'109 reapplication is entirely idempotent');
 equal(await snapshot(),dataBefore,'109 reapplication does not alter any existing business row');
 phase='rights and duration';
 await as(null,'anon');await denied('select ensure_essential_trial($1)',[orgs.fresh],/permission denied/,'Anonymous caller cannot execute trial creation');
 await as(null);await denied('select ensure_essential_trial($1)',[orgs.fresh],/BILLING_ADMIN_REQUIRED/,'Authenticated request without uid is refused');
 await as(ids.operator);await denied('select ensure_essential_trial($1)',[orgs.fresh],/BILLING_ADMIN_REQUIRED/,'Operator cannot create a trial');
 await as(ids.viewer);await denied('select ensure_essential_trial($1)',[orgs.fresh],/BILLING_ADMIN_REQUIRED/,'Viewer cannot create a trial');
 await as(ids.admin);await denied('select ensure_essential_trial($1)',[orgs.foreign],/BILLING_ADMIN_REQUIRED/,'Admin cannot create trial for another tenant');
 await as(null,'service_role');await denied('select ensure_essential_trial($1)',[orgs.fresh],/BILLING_ADMIN_REQUIRED/,'Existing service ACL does not bypass the authenticated admin guard');
 await as(ids.admin);equal((await one('select ensure_essential_trial($1) created',[orgs.fresh])).created,true,'Organization admin creates one new15day trial');
 const fresh=await one('select * from organization_subscriptions where organization_id=$1',[orgs.fresh]);
 equal(Number((await one('select extract(epoch from(trial_end-trial_start)) seconds from organization_subscriptions where organization_id=$1',[orgs.fresh])).seconds),1296000,'New trial lasts exactly360hours, not a calendar month');
 equal(Number(fresh.monthly_amount),99,'New trial preserves existing function monthly amount');equal(Number(fresh.yearly_amount),1188,'New trial preserves existing function yearly amount');
 equal(String(fresh.trial_end),String(fresh.trial_ends_at),'Both trial end columns agree');equal(String(fresh.trial_end),String(fresh.current_period_end),'Current period ends on the same precise expiry');
 equal((await one('select ensure_essential_trial($1) created',[orgs.fresh])).created,false,'Repeated RPC does not extend or reset the trial');
 equal(await one('select * from organization_subscriptions where organization_id=$1',[orgs.fresh]),fresh,'Repeated RPC preserves every new contract column');
 const oldBefore=await one('select * from organization_subscriptions where organization_id=$1',[orgs.legacy]);
 equal((await one('select ensure_essential_trial($1) created',[orgs.legacy])).created,false,'Existing30day trial is not replaced');
 equal(await one('select * from organization_subscriptions where organization_id=$1',[orgs.legacy]),oldBefore,'Existing30day trial dates and every column are unchanged');
 const paidBefore=await one('select * from organization_subscriptions where organization_id=$1',[orgs.paid]);
 equal((await one('select ensure_essential_trial($1) created',[orgs.paid])).created,false,'Existing paid contract is never converted to a trial');
 equal(await one('select * from organization_subscriptions where organization_id=$1',[orgs.paid]),paidBefore,'Paid contract identity status dates and amounts remain exact');
 await owner();
 await db.exec("set timezone='America/New_York'");
 equal(Number((await one("select extract(epoch from ((timestamptz '2026-03-01 12:00:00 America/New_York'+interval '360 hours')-timestamptz '2026-03-01 12:00:00 America/New_York')) seconds")).seconds),1296000,'360hours stays exact across a DST transition');
 equal(Number((await one("select extract(epoch from ((timestamptz '2026-03-01 12:00:00 America/New_York'+interval '15 days')-timestamptz '2026-03-01 12:00:00 America/New_York')) seconds")).seconds)!==1296000,true,'DST fixture distinguishes15calendar days from360hours');
 await db.exec("set timezone='UTC'");
 phase='rollback';const beforeRollback=await snapshot();
 equal((await install(rollback109)).essential_trial_109_rollback_actif,true,'Manual rollback reports restored calendar-month behavior');
 equal(await fn(),before,'Rollback restores the exact pre109 definition and all metadata');
 equal(await snapshot(),beforeRollback,'Rollback does not modify old,new15day or paid contracts');
 equal((await install(rollback109)).essential_trial_109_rollback_actif,true,'Manual rollback is idempotent');
 equal(await fn(),before,'Reapplied rollback remains exact');
 await as(ids.admin);equal((await one('select ensure_essential_trial($1) created',[orgs.rolled])).created,true,'Rollback affects only a subsequently created trial');
 equal((await one("select trial_end=trial_start+interval '1 month' old from organization_subscriptions where organization_id=$1",[orgs.rolled])).old,true,'New trial after rollback uses the original calendar month');
 equal(await one('select * from organization_subscriptions where organization_id=$1',[orgs.fresh]),fresh,'A15day contract created before rollback stays unchanged');
 await owner();
 phase='fail closed and atomicity';
 for(const corruption of ['missing-date','duplicate-date','guard-edit','unknown-body','amount-expression']){
  let bad=before.definition;
  if(corruption==='missing-date')bad=bad.replace(oldFragment,"ended := started + interval '15 days';");
  if(corruption==='duplicate-date')bad=bad.replace(oldFragment,oldFragment+' -- '+oldFragment);
  if(corruption==='guard-edit')bad=bad.replace('BILLING_ADMIN_REQUIRED','UNEXPECTED_GUARD');
  if(corruption==='unknown-body')bad=bad.replace('return true;','return true; -- unexpected extra source');
  if(corruption==='amount-expression')bad=bad.replace('false,99,1188);','false,99+1,1188);');
  if(bad===before.definition)throw Error('Review corruption marker '+corruption);
  await db.exec(bad);const altered=await fn(),data=await snapshot();let error;
  try{await db.exec(migration109);}catch(caught){error=caught;}await db.exec('rollback');
  equal(Boolean(error&&/TRIAL109_UNEXPECTED/.test(error.message)),true,'109 refuses unexpected function shape '+corruption);
  equal(await fn(),altered,'109 failure preserves the previously existing function '+corruption);
  equal(await snapshot(),data,'109 failure performs no business DML '+corruption);
  await db.exec(before.definition);
 }
 for(const security of ['invoker','anon','public']){
  if(security==='invoker')await db.exec('alter function '+signature+' security invoker');
  else await db.exec('grant execute on function '+signature+' to '+security);
  const altered=await fn();let error;try{await db.exec(migration109);}catch(caught){error=caught;}await db.exec('rollback');
  equal(Boolean(error&&/TRIAL109_UNEXPECTED_SECURITY/.test(error.message)),true,'109 refuses weakened preexisting security '+security);
  equal(await fn(),altered,'Refusal never silently changes the existing security '+security);
  if(security!=='invoker')await db.exec('revoke execute on function '+signature+' from '+security);
  await db.exec(before.definition);
 }
 equal(await install(migration109),{essential_trial_109_actif:true,days:15},'Final reinstallation succeeds after negative fixtures');
 equal(withoutSource((await fn()).meta),withoutSource(before.meta),'Final metadata owner ACL and config remain exact');
 await writeFile(output,JSON.stringify({passed:true,checks,results,engine,relaxedV3:process.argv.includes('--relaxed-v3'),migrationSha,scope:'Actual099/109 function and existing real security/bootstrap in disposable PostgreSQL. No environment, hosted DB, account, payment or production mutation. Concurrent lock is preserved in source; serial idempotency tested here.'},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks,engine,output}));
}catch(error){console.error(JSON.stringify({passed:false,phase,checks,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}finally{await db.close();}
`;
const runtime=new URL('.trial109-runtime-'+randomUUID()+'.mjs',import.meta.url);
try{await writeFile(runtime,source);await import(pathToFileURL(fileURLToPath(runtime)).href);}finally{await unlink(runtime);}
