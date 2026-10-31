// Restores only a synthetic native PostgreSQL race fixture, never hosted Supabase.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const option=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const base=new URL(option('postgres-url'));
assert(['127.0.0.1','localhost'].includes(base.hostname)&&base.port==='55439'&&base.username==='postgres'&&!base.password&&/^\/numbering_qa_[a-z0-9_]+$/i.test(base.pathname),'Dedicated local QA database required');
const concurrency=JSON.parse(await readFile(new URL('database-concurrency.json',import.meta.url),'utf8'));
assert(concurrency.passed&&/^numbering_qa_einvoice_races_\d+$/.test(concurrency.database),'Successful synthetic concurrency fixture required');
base.pathname='/'+concurrency.database;
const bin=resolve(option('pg-bin'));const {Client}=createRequire(resolve(option('pg-root'),'package.json'))('pg');
const stamp=Date.now();const restored='numbering_qa_einvoice_restore_'+stamp;const restoredUrl=new URL(base);restoredUrl.pathname='/'+restored;
const backupDir=resolve('../backups/e-invoicing-native-20261031');await mkdir(backupDir,{recursive:true});const dump=join(backupDir,'einvoice-fixture-'+stamp+'.dump');
const source=new Client({connectionString:base.toString()});let target;const checks=[];const check=(name,passed)=>{checks.push({name,passed});assert(passed,name);};
async function snapshot(db){
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in('public','auth','app_private') order by schemaname,tablename")).rows;const rows=[];
 for(const table of tables){assert(/^[a-z_]+$/.test(table.schemaname)&&/^[a-z_]+$/.test(table.tablename));const result=await db.query(`select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,'|'order by to_jsonb(t)::text),'')) hash from "${table.schemaname}"."${table.tablename}" t`);rows.push({table:table.schemaname+'.'+table.tablename,...result.rows[0]});}
 const policies=(await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 return{tables:rows,policies};
}
try{
 await source.connect();const before=await snapshot(source);const args=['-h',base.hostname,'-p',base.port,'-U','postgres'];
 execFileSync(join(bin,'pg_dump.exe'),[...args,'-d',concurrency.database,'-Fc','-f',dump],{windowsHide:true,stdio:'pipe'});
 execFileSync(join(bin,'createdb.exe'),[...args,restored],{windowsHide:true,stdio:'pipe'});
 const started=Date.now();execFileSync(join(bin,'pg_restore.exe'),[...args,'--exit-on-error','--single-transaction','-d',restored,dump],{windowsHide:true,stdio:'pipe'});const restoreMs=Date.now()-started;
 target=new Client({connectionString:restoredUrl.toString()});await target.connect();const after=await snapshot(target);
 check('All restored table counts and exact row digests match',JSON.stringify(before.tables)===JSON.stringify(after.tables));check('All restored RLS policies match',JSON.stringify(before.policies)===JSON.stringify(after.policies));
 const artifacts=(await target.query("select format,byte_length,octet_length(content) actual_length,sha256,encode(sha256(content),'hex') actual_hash from einvoice_artifacts")).rows;
 check('Restored fixture contains both XML and PDF archives',artifacts.some(row=>row.format==='xml')&&artifacts.some(row=>row.format==='pdf'));check('Every restored binary archive verifies its exact SHA256 and size',artifacts.every(row=>row.sha256===row.actual_hash&&row.byte_length===row.actual_length));
 const versions=(await target.query("select snapshot_sha256,encode(sha256(convert_to(canonical_snapshot,'UTF8')),'hex') computed from einvoice_versions")).rows;check('Every restored canonical snapshot verifies its own SHA256',versions.every(row=>row.snapshot_sha256===row.computed));
 const members=(await target.query("select m.user_id,m.organization_id,r.name from organization_members m join roles r on r.id=m.role_id and r.organization_id=m.organization_id where m.status='active'order by r.name")).rows;
 check('Three fixture role memberships are restored',members.length===3&&['admin','operator','viewer'].every(role=>members.some(row=>row.name===role)));
 for(const member of members){await target.query('begin');await target.query("select set_config('request.jwt.claim.sub',$1,true)",[member.user_id]);await target.query('set local role authenticated');const docs=(await target.query('select count(*)::int n from einvoice_documents where organization_id=$1',[member.organization_id])).rows[0].n;check(member.name+' reads its restored archive metadata through RLS',docs>0);await target.query('rollback');}
 const exactMigration=await readFile(resolve('supabase/migrations/102_electronic_invoicing_maroc.sql'),'utf8');const answer=await target.query(exactMigration);const indicator=(Array.isArray(answer)?answer.at(-1):answer).rows[0];check('Migration102 remains safely reapplicable after restore',indicator.facturation_electronique_102_active===true);const replayed=await snapshot(target);check('Migration reapplication preserves restored snapshots and all business data',JSON.stringify(before.tables)===JSON.stringify(replayed.tables));
 const report={passed:true,date:new Date().toISOString(),scope:'Synthetic local PostgreSQL dump/restore only; no production or hosted Supabase recovery',sourceDatabase:concurrency.database,restoredDatabase:restored,archiveCount:artifacts.length,versionCount:versions.length,tableCount:before.tables.length,policyCount:before.policies.length,backupSha256:createHash('sha256').update(await readFile(dump)).digest('hex'),migrationSha256:createHash('sha256').update(exactMigration).digest('hex'),restoreMs,checks,limitation:'Archive payloads are labeled SQL-boundary fixtures. This does not prove hosted backup/PITR, retention, or legally certified archiving.'};
 await writeFile(new URL('database-restore.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,archiveCount:artifacts.length,tableCount:before.tables.length,restoreMs}));
}catch(error){console.error(JSON.stringify({passed:false,message:error.message,checks}));process.exitCode=1;}finally{await target?.end();await source.end();}
