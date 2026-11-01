// Disposable real PostgreSQL bootstrap only. No .env or hosted URL accepted.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
if (!process.argv.some(arg=>arg.startsWith('--pglite-root=')) || process.argv.some(arg=>/--(?:postgres-url|pg-root)=/.test(arg))) throw Error('Disposable PGlite directory required; network targets refused');
const baseline=(await readFile(new URL('../../essential-fixes/20261031/verify-subscription-access.mjs',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const marker='\ntry {\n  await bootstrap();';
if(baseline.split(marker).length!==2)throw Error('Review changed099 bootstrap');
const migration=await readFile(new URL('../../../supabase/migrations/111_essential_trial_current_prices.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../../../supabase/rollback/111_essential_trial_current_prices.sql',import.meta.url),'utf8');
let source=baseline.slice(0,baseline.indexOf(marker));
source+='\nconst migration111='+JSON.stringify(migration)+';\nconst rollback111='+JSON.stringify(rollback)+';\n';
source+='const migrationSha='+JSON.stringify(createHash('sha256').update(migration).digest('hex'))+';\n';
source+='const output='+JSON.stringify(fileURLToPath(new URL(process.argv.includes('--relaxed-v3')?'trial-price111-relaxed.json':'trial-price111-strict.json',import.meta.url)))+';\n';
source+=String.raw`
const signature='public.ensure_essential_trial(uuid)';
const oldPrice='false,290,2900);',newPrice='false,99,1188);';
const orgs={email:ids.org,old30:ids.foreign,paid:'10000000-0000-4000-8000-000000001114',fresh:'10000000-0000-4000-8000-000000001115',rolled:'10000000-0000-4000-8000-000000001116'};
const owner=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
const fn=()=>one('select to_jsonb(p) meta,pg_get_functiondef(p.oid) definition from pg_proc p where oid=to_regprocedure($1)',[signature]);
const noSource=meta=>Object.fromEntries(Object.entries(meta).filter(([key])=>key!=='prosrc'));
const others=()=>one("select jsonb_agg(to_jsonb(p) order by p.oid) data from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','app_private') and p.oid<>to_regprocedure('public.ensure_essential_trial(uuid)')");
const snapshot=()=>one("select jsonb_build_object('contracts',(select jsonb_agg(to_jsonb(s) order by id) from organization_subscriptions s),'plans',(select jsonb_agg(to_jsonb(s) order by id) from subscription_plans s),'organizations',(select jsonb_agg(to_jsonb(s) order by id) from organizations s),'members',(select jsonb_agg(to_jsonb(s) order by id) from organization_members s),'profiles',(select jsonb_agg(to_jsonb(s) order by id) from profiles s)) data");
const row=org=>one('select * from organization_subscriptions where organization_id=$1',[org]);
async function install(statement){const response=await db.exec(statement);return response.at(-1).rows[0];}
async function denied(query,values,pattern,label){let error;try{await db.query(query,values);}catch(caught){error=caught;}equal(Boolean(error&&pattern.test(error.message)),true,label);}
try{
 await bootstrap();
 await db.exec("do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
 await db.exec(await sql('097_document_numbering_controls.sql'));
 await db.exec(await sql('099_essential_subscription_access.sql'));
 await db.exec(await sql('109_essential_trial_15_days.sql'));
 phase='price111 synthetic fixtures';
 await db.exec("update subscription_plans set monthly_price=99,yearly_price=1188,price_monthly=99,price_yearly=1188 where code='essentiel'");
 for(const[name,org]of Object.entries(orgs))await db.query('insert into organizations(id,name,slug) values($1,$2,$3)',[org,'Price111 '+name,'price111-'+name]);
 for(const[user,name]of [[ids.admin,'admin'],[ids.operator,'operator'],[ids.viewer,'viewer']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@price111.invalid']);
  await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@price111.invalid']);
  for(const org of Object.values(orgs)){
   const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[org,name]);
   await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[org,user,role.id]);
  }
 }
 await as(ids.admin);
 equal((await one('select ensure_essential_trial($1) created',[orgs.email])).created,true,'Before111 a109 new email-like trial is created');
 equal(Number((await row(orgs.email)).monthly_amount),290,'Before111 actual099/109 function retains old290MAD amount');
 equal((await one('select ensure_essential_trial($1) created',[orgs.old30])).created,true,'Historical30day fixture has a durable contract');
 await owner();
 await db.query("update organization_subscriptions set trial_start='2026-10-31T12:00:00Z',trial_started_at='2026-10-31T12:00:00Z',trial_end='2026-11-30T12:00:00Z',trial_ends_at='2026-11-30T12:00:00Z',current_period_start='2026-10-31T12:00:00Z',current_period_end='2026-11-30T12:00:00Z' where organization_id=$1",[orgs.old30]);
 await db.query("insert into organization_subscriptions(organization_id,plan_id,plan_code,status,billing_cycle,billing_interval,current_period_start,current_period_end,monthly_amount,yearly_amount) select $1,id,'premium','active','monthly','monthly','2026-11-01T12:00:00Z','2026-12-01T12:00:00Z',1290,12900 from subscription_plans where code='premium'",[orgs.paid]);
 await db.exec("create role trial111_owner bypassrls;create role trial111_extra;grant usage on schema public,auth,app_private to trial111_owner;grant select,insert,update,delete on all tables in schema public to trial111_owner;grant execute on all functions in schema app_private,auth to trial111_owner;");
 await db.exec('alter function '+signature+' owner to trial111_owner;alter function '+signature+" set statement_timeout='7s';grant execute on function "+signature+' to trial111_extra,service_role');
 const before=await fn(),beforeData=await snapshot(),beforeOthers=await others();
 equal(before.meta.prosrc.includes("ended := started + interval '360 hours';"),true,'111 starts from actual installed109 duration');
 phase='install111';
 equal(await install(migration111),{essential_trial_111_actif:true,monthly_mad:99,yearly_mad:1188,days:15},'111 reports99/1188MAD and15days');
 const patched=await fn();
 equal(patched.meta.prosrc,before.meta.prosrc.replace(oldPrice,newPrice),'111 changes exactly two price literals and no other source byte');
 equal(noSource(patched.meta),noSource(before.meta),'111 preserves OID owner ACL signature config and every non-source field');
 equal(await others(),beforeOthers,'111 never changes another public or app_private function');
 equal(await snapshot(),beforeData,'111 performs no DML on contracts catalogue organizations members or profiles');
 await install(migration111);equal(await fn(),patched,'111 reapplication is exact and idempotent');
 equal(await snapshot(),beforeData,'111 reapplication leaves every business row exact');
 phase='new contracts and rights';
 for(const[user,role,pattern,label]of [[null,'anon',/permission denied/,'Anon'],[null,'authenticated',/BILLING_ADMIN_REQUIRED/,'Missing uid'],[ids.operator,'authenticated',/BILLING_ADMIN_REQUIRED/,'Operator'],[ids.viewer,'authenticated',/BILLING_ADMIN_REQUIRED/,'Viewer'],[ids.outsider,'authenticated',/BILLING_ADMIN_REQUIRED/,'Unrelated tenant'],[null,'service_role',/BILLING_ADMIN_REQUIRED/,'Service ACL without uid']]){
  await as(user,role);await denied('select ensure_essential_trial($1)',[orgs.fresh],pattern,label+' cannot start a trial');
 }
 await as(ids.admin);equal((await one('select ensure_essential_trial($1) created',[orgs.fresh])).created,true,'Admin creates one future trial');
 const fresh=await row(orgs.fresh);
 equal([Number(fresh.monthly_amount),Number(fresh.yearly_amount)],[99,1188],'Future trial stores99/1188MAD');
 equal([fresh.plan_code,fresh.status,fresh.stripe_subscription_id,fresh.stripe_customer_id],['essentiel','trialing',null,null],'Future trial stays free ESSENTIEL without Stripe identifiers');
 equal(Number((await one('select extract(epoch from(trial_end-trial_start)) seconds from organization_subscriptions where organization_id=$1',[orgs.fresh])).seconds),1296000,'Future trial retains exact360hours');
 equal([String(fresh.trial_ends_at),String(fresh.current_period_end)],[String(fresh.trial_end),String(fresh.trial_end)],'Future end aliases agree');
 equal((await one('select ensure_essential_trial($1) created',[orgs.fresh])).created,false,'Repeated RPC returns false');
 equal(await row(orgs.fresh),fresh,'Repeated RPC preserves every contract column');
 for(const name of ['email','old30','paid']){
  const existing=await row(orgs[name]);
  equal((await one('select ensure_essential_trial($1) created',[orgs[name]])).created,false,'Existing '+name+' contract never replaced');
  equal(await row(orgs[name]),existing,'Every existing '+name+' contract column remains exact');
 }
 await owner();const dataAfterNew=await snapshot();
 phase='manual rollback111';
 equal((await install(rollback111)).essential_trial_111_rollback_actif,true,'Rollback reports restored future290/2900MAD');
 equal(await fn(),before,'Rollback restores exact pre111 definition metadata and OID');
 equal(await snapshot(),dataAfterNew,'Rollback preserves all old and new contracts');
 await install(rollback111);equal(await fn(),before,'Rollback reapplication is exact');
 await as(ids.admin);equal((await one('select ensure_essential_trial($1) created',[orgs.rolled])).created,true,'Rollback affects only a later trial');
 equal([Number((await row(orgs.rolled)).monthly_amount),Number((await row(orgs.rolled)).yearly_amount)],[290,2900],'New postrollback trial stores former290/2900MAD');
 equal(Number((await one('select extract(epoch from(trial_end-trial_start)) seconds from organization_subscriptions where organization_id=$1',[orgs.rolled])).seconds),1296000,'Rollback111 never reverts109 duration');
 equal(await row(orgs.fresh),fresh,'Existing99/1188 trial remains exact after rollback');
 await owner();
 phase='whitespace preservation';
 const spacedDefinition=before.definition.replace(oldPrice,'false, 290 ,\n    2900 );');
 if(spacedDefinition===before.definition)throw Error('Review known price fragment');
 await db.exec(spacedDefinition);const spaced=await fn();await install(migration111);
 equal((await fn()).meta.prosrc,spaced.meta.prosrc.replace('false, 290 ,\n    2900 );','false, 99 ,\n    1188 );'),'111 preserves all whitespace around changed literals');
 await install(rollback111);equal(await fn(),spaced,'Rollback restores exact spaced source');
 await db.exec(before.definition);
 phase='fail closed and atomicity';
 for(const mutation of ['month-duration','duplicate-date','wrong-guard','unknown-body','different-price','mixed-price','decimal-literal','amount-expression']){
  let bad=before.definition;
  if(mutation==='month-duration')bad=bad.replace("interval '360 hours'","interval '1 month'");
  if(mutation==='duplicate-date')bad=bad.replace('return true;',"return true; -- ended := started + interval '360 hours';");
  if(mutation==='wrong-guard')bad=bad.replace('BILLING_ADMIN_REQUIRED','UNEXPECTED_GUARD');
  if(mutation==='unknown-body')bad=bad.replace('return true;','return true; -- unknown shape');
  if(mutation==='different-price')bad=bad.replace(oldPrice,'false,199,1990);');
  if(mutation==='mixed-price')bad=bad.replace(oldPrice,'false,99,2900);');
  if(mutation==='decimal-literal')bad=bad.replace(oldPrice,'false,290.00,2900.00);');
  if(mutation==='amount-expression')bad=bad.replace(oldPrice,'false,290+1,2900);');
  if(bad===before.definition)throw Error('Missing corruption marker '+mutation);
  await db.exec(bad);
  for(const[operation,statement]of [['install',migration111],['rollback',rollback111]]){
   const altered=await fn(),data=await snapshot();let error;try{await db.exec(statement);}catch(caught){error=caught;}await db.exec('rollback');
   equal(Boolean(error&&/TRIAL111_/.test(error.message)),true,operation+' refuses '+mutation);
   equal(await fn(),altered,operation+' failure preserves existing function '+mutation);
   equal(await snapshot(),data,operation+' failure performs no DML '+mutation);
  }
  await db.exec(before.definition);
 }
 for(const security of ['invoker','anon','public']){
  if(security==='invoker')await db.exec('alter function '+signature+' security invoker');
  else await db.exec('grant execute on function '+signature+' to '+security);
  const altered=await fn();let error;try{await db.exec(migration111);}catch(caught){error=caught;}await db.exec('rollback');
  equal(Boolean(error&&/TRIAL111_UNEXPECTED_SECURITY/.test(error.message)),true,'111 refuses weakened security '+security);
  equal(await fn(),altered,'Refusal preserves existing security '+security);
  if(security!=='invoker')await db.exec('revoke execute on function '+signature+' from '+security);
  await db.exec(before.definition);
 }
 equal(await install(migration111),{essential_trial_111_actif:true,monthly_mad:99,yearly_mad:1188,days:15},'Final111 installation succeeds after negatives');
 equal(noSource((await fn()).meta),noSource(before.meta),'Final metadata remains exact');
 equal(await others(),beforeOthers,'No other function changed during negative fixtures');
 await writeFile(output,JSON.stringify({passed:true,checks,results,engine,relaxedV3:process.argv.includes('--relaxed-v3'),migrationSha,scope:'Real099/109/111 functions in disposable PostgreSQL. Future prices only, all historical contracts untouched. No environment, hosted SQL, customer, network or payment.'},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks,engine,output}));
}catch(error){console.error(JSON.stringify({passed:false,phase,checks,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}finally{await db.close();}
`;
const runtime=new URL('.trial111-runtime-'+randomUUID()+'.mjs',import.meta.url);
try{await writeFile(runtime,source);await import(pathToFileURL(fileURLToPath(runtime)).href);}finally{await unlink(runtime);}
