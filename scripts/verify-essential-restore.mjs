// Restore a disposable LOCAL PostgreSQL fixture. Never reads project credentials.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const sourceUrl=new URL(arg('postgres-url') || '');
assert(['127.0.0.1','localhost'].includes(sourceUrl.hostname) && sourceUrl.port==='55439' && /^\/numbering_qa_[a-z0-9_]+$/.test(sourceUrl.pathname) && sourceUrl.username==='postgres' && !sourceUrl.password,'Dedicated local numbering_qa_ fixture required');
const bin=resolve(arg('pg-bin') || '');
const pgRoot=resolve(arg('pg-root') || '');
const {Client}=createRequire(join(pgRoot,'package.json'))('pg');
const fixture=JSON.parse(await readFile(resolve('training/essential-fixes/20261031/native-finance-fixture.json'),'utf8'));
const stamp=new Date().toISOString().replace(/\D/g,'').slice(0,14);
const targetName='numbering_qa_restore_'+stamp;
const targetUrl=new URL(sourceUrl);targetUrl.pathname='/'+targetName;
const backupDir=resolve('../backups/native-essential-restoration-20261031');await mkdir(backupDir,{recursive:true});
const dump=join(backupDir,'essential-fixture-'+stamp+'.dump');
const source=new Client({connectionString:sourceUrl.toString()});await source.connect();
async function snapshot(db){
  const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','auth','storage','app_private') order by schemaname,tablename")).rows;
  const rows=[];
  for(const table of tables){
    assert(/^[a-z_][a-z0-9_]*$/.test(table.schemaname) && /^[a-z_][a-z0-9_]*$/.test(table.tablename));
    const result=await db.query(`select count(*)::int as count, md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) as digest from "${table.schemaname}"."${table.tablename}" t`);
    rows.push({table:table.schemaname+'.'+table.tablename,...result.rows[0]});
  }
  const policies=(await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','auth','storage','app_private') order by schemaname,tablename,policyname")).rows;
  return {tables:rows,policies};
}
let target;
const checks=[];
const check=(name,passed)=>{checks.push({name,passed});assert(passed,name);};
try{
  const before=await snapshot(source);
  const connectionArgs=['-h',sourceUrl.hostname,'-p',sourceUrl.port,'-U','postgres'];
  execFileSync(join(bin,'pg_dump.exe'),[...connectionArgs,'-d',sourceUrl.pathname.slice(1),'-Fc','-f',dump],{windowsHide:true,stdio:'pipe'});
  execFileSync(join(bin,'createdb.exe'),[...connectionArgs,targetName],{windowsHide:true,stdio:'pipe'});
  const started=Date.now();
  execFileSync(join(bin,'pg_restore.exe'),[...connectionArgs,'--exit-on-error','--single-transaction','-d',targetName,dump],{windowsHide:true,stdio:'pipe'});
  const restoreMs=Date.now()-started;
  target=new Client({connectionString:targetUrl.toString()});await target.connect();
  const after=await snapshot(target);
  check('all restored table counts and row digests match',JSON.stringify(before.tables)===JSON.stringify(after.tables));
  check('all row-security policies restored exactly',JSON.stringify(before.policies)===JSON.stringify(after.policies));
  const bundle=await readFile(resolve('supabase/essential-launch-098-101.sql'),'utf8');
  const applied=await target.query(bundle);
  const verification=(Array.isArray(applied)?applied.at(-1):applied).rows[0];
  check('combined release returns all four activation indicators',Object.values(verification).length===4 && Object.values(verification).every(value=>value===true));
  const afterBundle=await snapshot(target);
  check('combined release reapplication preserves restored business rows',JSON.stringify(before.tables)===JSON.stringify(afterBundle.tables));
  const members=(await target.query('select count(*)::int as count from organization_members where organization_id=$1 and status=$2',[fixture.org,'active'])).rows[0].count;
  check('three active test users restored',members===3);
  const balance=(await target.query('select count(*)::int as count from accounting_entries where organization_id=$1 and status=$2 and abs(total_debit-total_credit)>0.005',[fixture.org,'posted'])).rows[0].count;
  check('restored posted entries remain balanced',balance===0);
  for(const role of ['admin','operator','viewer']){
    await target.query('begin');
    await target.query('set local role authenticated');
    await target.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[fixture[role],JSON.stringify({sub:fixture[role],role:'authenticated'})]);
    const count=(await target.query('select count(*)::int as count from third_parties where organization_id=$1',[fixture.org])).rows[0].count;
    check(role+' can read own restored company',count>0);
    await target.query('rollback');
  }
  const report={date:new Date().toISOString(),scope:'Synthetic local PostgreSQL fixture only; no Supabase production backup or restore',sourceDatabase:sourceUrl.pathname.slice(1),restoredDatabase:targetName,backupSha256:createHash('sha256').update(await readFile(dump)).digest('hex'),restoreMs,tables:before.tables.map(x=>({table:x.table,count:x.count})),policyCount:before.policies.length,checks,success:true,limitation:'A hosted Supabase database and Storage recovery must also be verified with the provider configuration.'};
  await writeFile(resolve('training/essential-fixes/20261031/restoration.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({success:true,checks:checks.length,tables:before.tables.length,restoreMs}));
}finally{await target?.end();await source.end();}
