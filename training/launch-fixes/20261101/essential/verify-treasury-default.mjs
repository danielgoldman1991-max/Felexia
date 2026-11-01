// Fresh in-memory PostgreSQL only. Never reads project env or hosted data.
import { readFile, writeFile, mkdtemp, rm, rmdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
if (!process.argv.some(arg => arg.startsWith('--pglite-root=')) || process.argv.some(arg => arg.startsWith('--postgres-url='))) throw Error('Explicit disposable PGlite package root required');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const baseline = (await readFile(join(root, 'training/essential-fixes/20261031/verify-subscription-access.mjs'), 'utf8')).replaceAll('\r\n', '\n');
const marker = '\ntry {\n  await bootstrap();';
if (!baseline.includes(marker)) throw Error('Review changed trusted isolated bootstrap');
let source = baseline.slice(0, baseline.indexOf(marker)).replace('new URL(`../../../supabase/migrations/${file}`, import.meta.url)', 'new URL(file,' + JSON.stringify(pathToFileURL(join(root, 'supabase/migrations/')).href) + ')');
source += '\nconst proofOutput=' + JSON.stringify(fileURLToPath(new URL(process.argv.includes('--relaxed-v3') ? 'treasury-default-relaxed.json' : 'treasury-default-strict.json', import.meta.url))) + ';\n';
source += String.raw`
try {
  await bootstrap();
  await db.exec("do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
  await db.exec(await sql('099_essential_subscription_access.sql'));
  await db.exec('alter default privileges in schema public grant execute on functions to service_role');
  const migration = await sql('107_treasury_default_account_atomic.sql');
  await db.exec(migration); await db.exec(migration);
  equal((await one("select has_function_privilege('service_role','public.set_default_treasury_account_atomic(uuid,uuid)','execute') allowed")).allowed,false,'Default RPC removes inherited service-role execution');
  equal((await one("select has_function_privilege('anon','public.save_default_treasury_account_atomic(uuid,uuid,jsonb)','execute') allowed")).allowed,false,'Anonymous callers have no save RPC privilege');
  await db.exec('begin');
  for(const org of [ids.org,ids.foreign]) await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[org,'Synthetic Treasury107']);
  for(const [user,name,org] of [[ids.admin,'admin',ids.org],[ids.operator,'operator',ids.org],[ids.viewer,'viewer',ids.org],[ids.outsider,'admin',ids.foreign],[ids.accountant,'sales',ids.org]]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,user+'@example.test']);
    await db.query('insert into profiles(id,email) values($1,$2)',[user,user+'@example.test']);
    const role = await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[org,name]);
    await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[org,user,role.id]);
  }
  await as(ids.admin); await one('select ensure_essential_trial($1)',[ids.org]);
  const save = async(id,header)=>(await one('select save_default_treasury_account_atomic($1,$2,$3::jsonb) id',[ids.org,id,JSON.stringify(header)])).id;
  const prefer = async(id)=>(await one('select set_default_treasury_account_atomic($1,$2) id',[ids.org,id])).id;
  const defaults = async()=>Number((await one('select count(*) n from treasury_accounts where organization_id=$1 and is_default',[ids.org])).n);
  const a = await save(null,{name:'Bank A',code:'A',currency:'MAD',opening_balance:10,organization_id:ids.foreign,created_by:ids.outsider});
  const first = await one('select * from treasury_accounts where id=$1',[a]);
  equal(first.organization_id,ids.org,'Untrusted header cannot replace the session-bound organization');
  equal(first.created_by,ids.admin,'Creator is authenticated identity, not payload identity');
  equal(Number(first.current_balance),10,'Initial bank balance is stored once');
  equal(await defaults(),1,'Creating a preferred account produces exactly one preference');
  const b = await save(null,{name:'Bank B',code:'B',currency:'MAD',opening_balance:20});
  equal(await defaults(),1,'Creating another preferred account clears the former within the same transaction');
  equal((await one('select is_default from treasury_accounts where id=$1',[a])).is_default,false,'Previous account loses only its preference');
  equal(Number((await one('select current_balance from treasury_accounts where id=$1',[a])).current_balance),10,'Switching preference leaves old bank money unchanged');
  await prefer(a);
  await rejected(()=>prefer('99999999-0000-4000-8000-000000000099'),/TREASURY_ACCOUNT_NOT_FOUND/,'A nonexistent target is refused');
  equal((await one('select is_default from treasury_accounts where id=$1',[a])).is_default,true,'Missing target preserves the old preferred account');
  await rejected(()=>db.query('select set_default_treasury_account_atomic($1,$2)',[ids.foreign,a]),/TREASURY_ACCOUNT_WRITE_REQUIRED/,'Caller cannot switch another company preference');
  await save(a,{name:'Bank A renamed',code:'A',currency:'MAD',opening_balance:999,current_balance:999});
  const renamed = await one('select name,opening_balance,current_balance from treasury_accounts where id=$1',[a]);
  equal(renamed.name,'Bank A renamed','Preferred metadata editing succeeds');
  equal(Number(renamed.opening_balance),10,'Metadata save cannot rewrite opening balance');
  equal(Number(renamed.current_balance),10,'Metadata save cannot rewrite current balance');
  await as(null);await db.exec('reset role');
  const euro = await one("insert into treasury_accounts(organization_id,name,code,currency,opening_balance,current_balance)values($1,'Historical EUR','EUR','EUR',100,100)returning id",[ids.org]);
  await as(ids.admin);
  await rejected(()=>save(euro.id,{name:'Must not relabel',code:'EUR',currency:'MAD'}),/FINANCE_MAD_ONLY/,'Historical EUR account cannot be relabelled as MAD through preferred metadata save');
  const historic = await one('select name,currency,current_balance from treasury_accounts where id=$1',[euro.id]);
  equal(historic.currency,'EUR','Refused relabelling preserves historical currency');
  equal(Number(historic.current_balance),100,'Refused relabelling preserves historical foreign amount');
  await db.exec('reset role');
  const beforeReinstall = await one('select md5(jsonb_agg(to_jsonb(a)order by id)::text) fingerprint from treasury_accounts a');
  await db.exec(migration.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
  equal((await one('select md5(jsonb_agg(to_jsonb(a)order by id)::text) fingerprint from treasury_accounts a')).fingerprint,beforeReinstall.fingerprint,'Reinstall preserves existing accounts, balances and preferences exactly');
  await db.exec("create function public.synthetic_default_failure()returns trigger language plpgsql as $$ begin if new.code like 'FAIL%' and new.is_default then raise exception 'SYNTHETIC_DEFAULT_FAILURE';end if;return new;end $$;create trigger synthetic_default_failure before insert or update on treasury_accounts for each row execute function synthetic_default_failure();");
  await as(ids.admin);
  const failed = await one("insert into treasury_accounts(organization_id,name,code,is_default,currency)values($1,'Original failure bank','FAIL',false,'MAD')returning id",[ids.org]);
  await rejected(()=>prefer(failed.id),/SYNTHETIC_DEFAULT_FAILURE/,'A failure after preference reset aborts the whole switch');
  equal((await one('select is_default from treasury_accounts where id=$1',[a])).is_default,true,'Post-reset failure restores previous preference');
  await rejected(()=>save(failed.id,{name:'Must roll back',code:'FAIL',currency:'MAD'}),/SYNTHETIC_DEFAULT_FAILURE/,'Metadata and preferred switch fail as one transaction');
  equal((await one('select name from treasury_accounts where id=$1',[failed.id])).name,'Original failure bank','Failed preferred edit preserves old metadata');
  const countBefore = Number((await one('select count(*)n from treasury_accounts where organization_id=$1',[ids.org])).n);
  await rejected(()=>save(null,{name:'Must not persist',code:'FAILNEW',currency:'MAD'}),/SYNTHETIC_DEFAULT_FAILURE/,'Preferred creation rolls back when final switch fails');
  equal(Number((await one('select count(*)n from treasury_accounts where organization_id=$1',[ids.org])).n),countBefore,'Failed preferred creation leaves no orphan bank');
  equal(await defaults(),1,'All failed operations retain exactly one old preference');
  for(const user of [ids.viewer,ids.operator,ids.outsider]) {
    await as(user);
    await rejected(()=>prefer(b),/TREASURY_ACCOUNT_WRITE_REQUIRED/,'Viewer/operator/non-member cannot switch preference:'+user);
    await rejected(()=>save(null,{name:'Forbidden'}),/TREASURY_ACCOUNT_WRITE_REQUIRED/,'Viewer/operator/non-member cannot create preferred bank:'+user);
  }
  await as(ids.accountant);
  if(!process.argv.includes('--relaxed-v3')) {
    await rejected(()=>prefer(b),/TREASURY_ACCOUNT_NOT_FOUND|permission denied|row-level security/,'Invoker RPC preserves restrictive financial RLS for a sales member');
    await as(ids.admin);equal((await one('select is_default from treasury_accounts where id=$1',[a])).is_default,true,'Denied financial RLS cannot reset the existing preference');
  } else {
    equal(await prefer(b),b,'Invoker RPC retains existing relaxed-policy member scope');
    await as(ids.admin);await prefer(a);
  }
  await as(null,'anon');await rejected(()=>prefer(b),/permission denied/,'Anonymous cannot execute preference RPC');
  await as(null,'service_role');await rejected(()=>prefer(b),/permission denied/,'Service role cannot execute preference RPC');
  await db.exec('reset role');await db.query("update organization_subscriptions set trial_end=now()-interval'1day',trial_ends_at=now()-interval'1day' where organization_id=$1",[ids.org]);
  await as(ids.admin);await rejected(()=>prefer(b),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription cannot switch preference');
  equal((await one('select is_default from treasury_accounts where id=$1',[a])).is_default,true,'Expired write refusal preserves existing preference');
  equal(Number((await one('select count(*)n from treasury_transactions where organization_id=$1',[ids.org])).n),0,'Preference and metadata changes never create cash movements');
  await db.exec('reset role;rollback');
  equal(Number((await one('select count(*)n from organizations where id=$1',[ids.org])).n),0,'All business fixtures are rolled back');
  await writeFile(proofOutput,JSON.stringify({at:new Date().toISOString(),passed:true,checks,results,engine,scope:'Real migration107 and existing RLS/subscription triggers in disposable PGlite; no cloud reads/writes; failure after reset injected',concurrentConnectionsTested:false},null,2)+'\n');
  console.log(JSON.stringify({passed:true,checks,engine}));
}catch(error){console.error(JSON.stringify({passed:false,checks,phase,message:error.message,where:error.where,detail:error.detail,results}));process.exitCode=1;}finally{await db.close();}
`;
const folder = await mkdtemp(join(tmpdir(), 'launch-treasury107-'));
const runtime = join(folder, 'verify.mjs');
try { await writeFile(runtime, source); await import(pathToFileURL(runtime).href); }
finally { await rm(runtime, { force: true }); await rmdir(folder); }
