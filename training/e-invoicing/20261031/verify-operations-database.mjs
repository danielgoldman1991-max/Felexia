// Additive103 contract tests. Disposable loopback PostgreSQL/PGlite only.
// XML/PDF here are explicitly SQL-boundary fixtures; rendering is tested separately.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdtemp,rm,rmdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

const root=fileURLToPath(new URL('../../../',import.meta.url));
let nativeDatabase=null;
if(process.argv.includes('--native')){
 const pgRoot=process.argv.find(arg=>arg.startsWith('--pg-root='))?.slice(10);
 if(!pgRoot)throw Error('An isolated pg package root is required');
 const {Client}=createRequire(resolve(pgRoot,'package.json'))('pg');
 const control=new Client({connectionString:'postgresql://postgres@127.0.0.1:55439/postgres'});
 nativeDatabase='numbering_qa_einvoice_operations_'+Date.now();
 await control.connect();try{await control.query('create database '+nativeDatabase);}finally{await control.end();}
 process.argv.push('--postgres-url=postgresql://postgres@127.0.0.1:55439/'+nativeDatabase);
}
const baseline=(await readFile(join(root,'training/essential-fixes/20261031/verify-subscription-access.mjs'),'utf8')).replaceAll('\r\n','\n');
const marker='\ntry {\n  await bootstrap();';assert(baseline.includes(marker),'Review changed trusted bootstrap');
let source=baseline.slice(0,baseline.indexOf(marker)).replace('new URL(`../../../supabase/migrations/${file}`, import.meta.url)','new URL(file,'+JSON.stringify(pathToFileURL(join(root,'supabase/migrations/')).href)+')');
const blueprint=(await readFile(join(root,'training/e-invoicing/20261031/verify-database.mjs'),'utf8')).replaceAll('\r\n','\n');
const rawStart=blueprint.indexOf('source+=String.raw`')+'source+=String.raw`'.length;
const testStart=blueprint.indexOf('\ntry{',rawStart);
const fixtureEnd=blueprint.indexOf('\n const draftCapture=',testStart);
assert(rawStart>20&&testStart>rawStart&&fixtureEnd>testStart,'Review changed trusted e-invoicing fixture');
source+=blueprint.slice(rawStart,testStart);
source+='\nconst proofOutput='+JSON.stringify(fileURLToPath(new URL(process.argv.includes('--native')?'operations-database-native.json':process.argv.includes('--relaxed-v3')?'operations-database-relaxed.json':'operations-database-strict.json',import.meta.url)))+';\n';
source+='const nativeDatabase='+JSON.stringify(nativeDatabase)+';\n';
const fixtureScript=blueprint.slice(testStart+'\ntry{'.length,fixtureEnd);
assert(fixtureScript.includes(" await db.exec('begin');"),'Review changed fixture transaction boundary');
source+='try{'+fixtureScript.replace(" await db.exec('begin');"," await db.exec(await sql('103_electronic_invoicing_operations.sql'));await db.exec(await sql('103_electronic_invoicing_operations.sql'));await db.exec('begin');");
source+=String.raw`
 await as(ids.admin);
 equal(Boolean((await one("select to_regprocedure('public.einvoice_issue_and_archive(uuid,integer)') present")).present),true,'Additive103 installs and reinstalls safely');
 let config=await settings('disabled',true,null,{alerts_enabled:true,default_unit_code:'HUR'});
 equal(config.connector_mode,'disabled','Document operation is active without a simulation or external connector');
 const capabilities=async(org)=>(await one('select einvoice_get_capabilities($1) result',[org])).result;
 await as(ids.viewer);equal(await capabilities(ids.org),{workflow_version:2,atomic_issuance:true},'Read-only members can inspect the exact operational readiness metadata');
 await as(ids.admin);await rejected(()=>capabilities(ids.foreign),/EINVOICE_ACCESS_DENIED/,'Readiness metadata cannot be read across enterprises');
 await as(ids.outsider);await rejected(()=>capabilities(ids.org),/EINVOICE_ACCESS_DENIED/,'Non-members cannot inspect company readiness');
 await as(null,'anon');await rejected(()=>capabilities(ids.org),/permission denied/,'Anonymous callers cannot execute the readiness RPC');
 await as(null,'service_role');await rejected(()=>capabilities(ids.org),/permission denied/,'Readiness RPC is restricted to authenticated membership rather than service access');
 await as(ids.admin);
 const finalize=async(id,version)=>(await one('select einvoice_issue_and_archive($1,$2) result',[id,version])).result;
 async function fresh(){
  await as(ids.admin);const source=await one('select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb)id',[ids.org,JSON.stringify({customer_id:customer.id,invoice_date:'2026-10-31'}),JSON.stringify([{description:'Operational invoice fixture',quantity:'1.000',unit_price_ht:'100.00',discount_rate:'0.00',tax_rate:'20.00'}])]);
  await db.query("update customer_invoices set status='validated'where id=$1",[source.id]);const raw=await capture('invoice',source.id);const document=await service(()=>save({capture:raw}));return{source:source.id,raw,document};
 }
 await db.query("update customer_invoices set status='validated'where id=$1",[invoice.id]);captured=await capture('invoice',invoice.id);
 const prepared=await service(()=>save());
 await as(ids.viewer);await rejected(()=>finalize(prepared.document_id,1),/EINVOICE_WRITE_REQUIRED/,'Read-only membership cannot issue and archive');
 await as(ids.outsider);await rejected(()=>finalize(prepared.document_id,1),/EINVOICE_ACCESS_DENIED/,'A different tenant cannot finalize a foreign document');
 await as(null,'anon');await rejected(()=>finalize(prepared.document_id,1),/permission denied/,'Anonymous callers cannot execute the finalization RPC');
 await as(null,'service_role');await rejected(()=>finalize(prepared.document_id,1),/permission denied/,'The finalization endpoint is not implicitly exposed to the service role');
 await as(ids.admin);await rejected(()=>finalize(foreignDoc.id,1),/EINVOICE_ACCESS_DENIED/,'An administrator cannot finalize another enterprise document');
 await rejected(()=>finalize(prepared.document_id,99),/EINVOICE_CONFLICT/,'Version comparison prevents finalization of an obsolete form');
 const issueEventsBefore=Number((await one("select count(*)n from einvoice_events where document_id=$1 and event in('document.validated','document.issued')",[prepared.document_id])).n);
 await as(ids.operator);const issued=await finalize(prepared.document_id,1);equal(issued.status,'issued','Operator validates and issues a prepared document in one call');
 const committed=await one('select status,issued_at,current_version_id,simulation_status from einvoice_documents where id=$1',[prepared.document_id]);equal(committed.status,'issued','Successful atomic finalization persists the issued state');equal(Boolean(committed.issued_at),true,'Successful atomic finalization freezes its issuance timestamp');equal(committed.current_version_id,prepared.version_id,'Finalization preserves the exact generated archive version');equal(committed.simulation_status,'not_submitted','Document issuance does not pretend an external transmission');
 equal(Number((await one("select count(*)n from einvoice_events where document_id=$1 and event in('document.validated','document.issued')",[prepared.document_id])).n),issueEventsBefore+2,'Validation and issuance are both audited within the transaction');
 const retried=await finalize(prepared.document_id,1);equal(retried.reused,true,'A repeated finalize request is idempotent');equal(retried.version_id,prepared.version_id,'Idempotence never creates another version');
 equal(Number((await one("select count(*)n from einvoice_events where document_id=$1 and event in('document.validated','document.issued')",[prepared.document_id])).n),issueEventsBefore+2,'Idempotent requests do not duplicate lifecycle audit events');
 equal((await one('select invoice_number from customer_invoices where id=$1',[invoice.id])).invoice_number,captured.facts.header.number,'Atomic finalization preserves the commercial number');
 equal(Number((await one('select count(*)n from accounting_entries where organization_id=$1',[ids.org])).n),0,'Finalization does not create a duplicate accounting entry');
 equal(Number((await one('select count(*)n from einvoice_jobs where organization_id=$1',[ids.org])).n),0,'Document mode never queues simulation work');
 const invalidSource=await one('select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb)id',[ids.org,JSON.stringify({customer_id:customer.id}),JSON.stringify([{description:'Invalid preparation fixture',quantity:'1.000',unit_price_ht:'5.00',tax_rate:'20.00'}])]);await db.query("update customer_invoices set status='validated'where id=$1",[invalidSource.id]);
 const invalidCapture=await capture('invoice',invalidSource.id);const invalid=await service(()=>save({capture:invalidCapture,valid:{valid:false,issues:[{code:'TEST_REQUIRED_FIELD'}],xsd:{valid:false,notRun:true}},files:[]}));
 await rejected(()=>finalize(invalid.document_id,1),/EINVOICE_VALID_ARTIFACTS_REQUIRED/,'Incomplete preparation cannot be issued or archived');equal((await one('select status from einvoice_documents where id=$1',[invalid.document_id])).status,'draft','Incomplete preparation remains correctable');
 const stale=await fresh();await db.query("update third_parties set address='Changed after generation'where id=$1",[customer.id]);
 const staleEventsBefore=Number((await one("select count(*)n from einvoice_events where document_id=$1 and event='document.validated'",[stale.document.document_id])).n);
 await rejected(()=>finalize(stale.document.document_id,1),/EINVOICE_SOURCE_CHANGED/,'Changed fiscal source rejects atomic finalization');
 const staleState=await one('select status,issued_at from einvoice_documents where id=$1',[stale.document.document_id]);equal(staleState.status,'draft','Failed issuance rolls back its preliminary validated state');equal(staleState.issued_at,null,'Failed issuance leaves no issuance timestamp');
 equal(Number((await one("select count(*)n from einvoice_events where document_id=$1 and event='document.validated'",[stale.document.document_id])).n),staleEventsBefore,'Failed issuance also rolls back the validation audit event');
 const fiscal=await fresh();config=await settings('disabled',true,config.revision,{alerts_enabled:true,default_unit_code:'DAY'});
 await rejected(()=>finalize(fiscal.document.document_id,1),/EINVOICE_CONFIGURATION_CHANGED/,'Changed fiscal settings reject finalization');equal((await one('select status from einvoice_documents where id=$1',[fiscal.document.document_id])).status,'draft','Changed fiscal settings leave no partially validated state');
 const subscribed=await fresh();await owner();const subscription=await one('select trial_end,trial_ends_at from organization_subscriptions where organization_id=$1',[ids.org]);await db.query("update organization_subscriptions set trial_end=now()-interval'1 day',trial_ends_at=now()-interval'1 day'where organization_id=$1",[ids.org]);await as(ids.admin);
 await as(ids.viewer);equal(await capabilities(ids.org),{workflow_version:2,atomic_issuance:true},'Expired subscription retains read-only readiness inspection without granting issuance');await as(ids.admin);
 await rejected(()=>finalize(subscribed.document.document_id,1),/SUBSCRIPTION_WRITE_REQUIRED/,'Expired subscription cannot finalize a document');
 await owner();await db.query('update organization_subscriptions set trial_end=$2,trial_ends_at=$3 where organization_id=$1',[ids.org,subscription.trial_end,subscription.trial_ends_at]);await as(ids.admin);
 config=await settings('disabled',false,config.revision,{alerts_enabled:true,default_unit_code:'DAY'});await rejected(()=>finalize(subscribed.document.document_id,1),/EINVOICE_MODULE_DISABLED/,'Disabled company module blocks even a generated valid document');
 config=await settings('disabled',true,config.revision,{alerts_enabled:true,default_unit_code:'DAY'});equal((await finalize(subscribed.document.document_id,1)).status,'issued','Reactivation restores normal document issuance');
 const alreadyValidated=await fresh();await transition(alreadyValidated.document.document_id,1,'validated');equal((await finalize(alreadyValidated.document.document_id,1)).status,'issued','Previously validated versions retain the operational issuance path');
 await transition(alreadyValidated.document.document_id,1,'ready_to_submit');equal((await finalize(alreadyValidated.document.document_id,1)).reused,true,'Already archived legacy ready states are idempotently retained');
 await owner();await db.exec('set constraints all immediate;rollback');equal(Number((await one('select count(*)n from organizations where id=$1',[ids.org])).n),0,'Operational test fixtures roll back completely');
 const report={passed:true,date:new Date().toISOString(),engine,database:nativeDatabase,migration103Sha256:sha(await sql('103_electronic_invoicing_operations.sql')),checks,results,scope:'Real isolated PostgreSQL contracts for atomic issue/archive, rollback, tenant/roles and document mode; SQL archive bytes are explicit fixtures, not render/XSD evidence',productionRead:false,productionWrite:false};await writeFile(proofOutput,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,engine,checks,output:proofOutput}));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,code:error.code,detail:error.detail,where:error.where,results}));process.exitCode=1;}finally{await db.close();}
`;
const folder=await mkdtemp(join(tmpdir(),'einvoice-operations-database-'));const runtime=join(folder,'verify.mjs');
try{await writeFile(runtime,source);await import(pathToFileURL(runtime).href);}finally{await rm(runtime,{force:true});await rmdir(folder);}
