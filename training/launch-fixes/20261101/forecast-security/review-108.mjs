// Independent disposable extension. No env, hosted connection, product or SQL edit.
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const folder=fileURLToPath(new URL('./',import.meta.url));
const root=fileURLToPath(new URL('../../../../',import.meta.url));
let source=(await readFile(join(root,'training/launch-fixes/20261101/pro-transactions/verify-conflict-status.mjs'),'utf8')).replace(/\r\n/g,'\n');
const originalMarker="const original=await readFile(join(folder,'verify-database.mjs'),'utf8');";
if(source.split(originalMarker).length!==2)throw Error('Review changed108 wrapper');
source=source.replace(originalMarker,`let original=await readFile(join(folder,'../pro-transactions/verify-database.mjs'),'utf8');
const installMarker=" for(const file of ['016_sales_documents_payment_terms.sql'";
if(!original.includes(installMarker))throw Error('Review changed real-migration install');
original=original.replace(installMarker," await db.exec('alter default privileges grant execute on functions to public,anon,authenticated,service_role;');\\n"+installMarker);`);
const captureMarker=' const oldSave=await getProc(saveSignature);const oldPay=await getProc(paySignature);';
if(source.split(captureMarker).length!==2)throw Error('Review changed108 snapshot point');
source=source.replace(captureMarker,String.raw`
 await db.exec('create role audit_108_extra;grant execute on function public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamptz,jsonb,jsonb),public.prepare_hr_payroll_atomic(uuid,uuid,timestamptz,boolean) to audit_108_extra;');
`+captureMarker);
const patchMarker=' await db.exec(conflictSql);\n const patchedSave=await getProc(saveSignature);const patchedPay=await getProc(paySignature);';
if(source.split(patchMarker).length!==2)throw Error('Review changed108 canonical patch point');
source=source.replace(patchMarker,String.raw`
 // Weak security metadata must fail even when the full body fingerprint is exact.
 for(const bad of ['invoker','service-grant','extra-config']){
  if(bad==='invoker')await db.exec('alter function '+saveSignature+' security invoker');
  if(bad==='service-grant')await db.exec('grant execute on function '+saveSignature+' to service_role');
  if(bad==='extra-config')await db.exec("alter function "+saveSignature+" set statement_timeout='3s'");
  const invalid=await getProc(saveSignature);let error;
  try{await db.exec(conflictSql);}catch(caught){error=caught;}
  await db.exec('rollback');
  equal(Boolean(error&&/PRO108_UNEXPECTED_SECURITY/.test(error.message)),true,'108 refuses altered security '+bad);
  equal(await getProc(saveSignature),invalid,'108 rollback preserves the previously altered metadata '+bad);
  equal(await getProc(paySignature),oldPay,'108 leaves second function exact when first security refuses '+bad);
  if(bad==='service-grant')await db.exec('revoke execute on function '+saveSignature+' from service_role');
  await db.exec(oldSave.definition);
 }
 // A known partially patched function is accepted, without accepting arbitrary text.
 await db.exec(oldSave.definition.replace("raise exception 'PRO_DOCUMENT_CHANGED' using errcode='40001';","raise exception 'PRO_DOCUMENT_CHANGED' using errcode='PT409';"));
 await db.exec(conflictSql);
 equal((await getProc(saveSignature)).meta.prosrc,oldSave.meta.prosrc.replace("raise exception 'PRO_DOCUMENT_CHANGED' using errcode='40001';","raise exception 'PRO_DOCUMENT_CHANGED' using errcode='PT409';").replace("raise exception 'PRO_TAX_RATE_CHANGED' using errcode='40001';","raise exception 'PRO_TAX_RATE_CHANGED' using errcode='PT409';"),'108 completes only the known partial business-conflict patch');
 equal(withoutSource((await getProc(saveSignature)).meta),withoutSource(oldSave.meta),'108 partial patch keeps realistic pg_proc non-source metadata exact');
 equal(await currentData(),dataBefore,'108 partial patch preserves witness rows');
 await db.exec(oldSave.definition);await db.exec(oldPay.definition);
`+patchMarker);
const privilegeMarker=" equal(privileges,{auth:true,anon:false,service:false},'108 retains authenticated-only commercial EXECUTE');";
if(source.split(privilegeMarker).length!==2)throw Error('Review changed108 ACL point');
source=source.replace(privilegeMarker,privilegeMarker+String.raw`
 const extra=await one("select has_function_privilege('audit_108_extra',$1::regprocedure,'EXECUTE') commercial,has_function_privilege('audit_108_extra',$2::regprocedure,'EXECUTE') payroll",[saveSignature,paySignature]);
 equal(extra,{commercial:true,payroll:true},'108 preserves explicitly existing extra grants across replace and reapply');
 const payrollPrivileges=await one("select has_function_privilege('authenticated',$1::regprocedure,'EXECUTE') auth,has_function_privilege('anon',$1::regprocedure,'EXECUTE') anon,has_function_privilege('service_role',$1::regprocedure,'EXECUTE') service",[paySignature]);
 equal(payrollPrivileges,{auth:true,anon:false,service:false},'108 payroll rejects PUBLIC-derived anon and service grants despite broad default privileges');
`);
source=source.replaceAll("'conflict-108-'","'review-108-'");
const migrationHash=createHash('sha256').update(await readFile(join(root,'supabase/migrations/108_pro_conflict_http_status.sql'))).digest('hex');
const runner=join(folder,'.independent108-review.mjs');
try{
 await writeFile(runner,source);await import(pathToFileURL(runner).href);
 if(!process.exitCode){
  const output=join(folder,process.argv.includes('--relaxed-v3')?'review-108-relaxed.json':'review-108-strict.json');
  const report=JSON.parse(await readFile(output,'utf8'));
  report.independentReview={migrationSha256:migrationHash,broadDefaultPrivilegesBefore105:true,knownPartialPatchChecked:true,existingExtraExecuteGrantsPreserved:true,fullPgProcMetadataExceptSourceCompared:true,noHostedAccess:true};
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
 }
}finally{await unlink(runner);}
