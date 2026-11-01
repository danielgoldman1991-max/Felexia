// Isolated108 regression; reuses the real105/106 cases without changing them.
import {readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const folder=fileURLToPath(new URL('./',import.meta.url));
const original=await readFile(join(folder,'verify-database.mjs'),'utf8');
const marker=" await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;begin');";
if(original.split(marker).length!==2)throw Error('Review changed SQL regression harness');
const extension=String.raw`
 phase='108 metadata and transactional patch';
 await db.exec(await sql('107_treasury_default_account_atomic.sql'));
 const conflictSql=await sql('108_pro_conflict_http_status.sql');
 const saveSignature='public.save_pro_commercial_document_atomic(uuid,uuid,text,timestamp with time zone,jsonb,jsonb)';
 const paySignature='public.prepare_hr_payroll_atomic(uuid,uuid,timestamp with time zone,boolean)';
 const getProc=async signature=>await one('select to_jsonb(p) meta, pg_get_functiondef(p.oid) definition from pg_proc p where oid=to_regprocedure($1)',[signature]);
 const withoutSource=meta=>Object.fromEntries(Object.entries(meta).filter(([key])=>key!=='prosrc'));
 const oldSave=await getProc(saveSignature);const oldPay=await getProc(paySignature);
 const otherBefore=(await one("select pg_get_functiondef('public.convert_pro_quote_to_order_atomic(uuid,uuid)'::regprocedure) value")).value;
 const witness=await one("insert into organizations(id,name,slug) values('00000000-0000-4000-8000-000000001108','Isolated108 witness','isolated108-witness') returning *");
 const bank=await one("insert into treasury_accounts(organization_id,name,account_type,currency,opening_balance,current_balance) values($1,'Isolated108 bank','bank','MAD',17,17) returning *",[witness.id]);
 const dataBefore=JSON.stringify({witness,bank});
 const currentData=async()=>JSON.stringify({witness:await one('select * from organizations where id=$1',[witness.id]),bank:await one('select * from treasury_accounts where id=$1',[bank.id])});
 for(const corruption of ['missing-fragment','unexpected-body']){
  const badDefinition=corruption==='missing-fragment'?oldPay.definition.replace('PAYROLL_PERIOD_CHANGED','PAYROLL_PERIOD_UNEXPECTED'):oldPay.definition.replace('-- Lock inputs and existing outputs before validating the entire set.','-- Lock inputs and existing outputs before validating the entire set. Unexpected fixture edit.');
  if(badDefinition===oldPay.definition)throw Error('Review changed payroll fixture definition');
  await db.exec(badDefinition);
  let error;try{await db.exec(conflictSql);}catch(caught){error=caught;}
  await db.exec('rollback');
  equal(Boolean(error&&/PRO108_UNEXPECTED_FRAGMENT|PRO108_UNEXPECTED_DEFINITION/.test(error.message)),true,'108 refuses '+corruption);
  equal((await getProc(saveSignature)).definition,oldSave.definition,'108 rolls back first function when second is '+corruption);
  equal((await getProc(paySignature)).definition,badDefinition,'108 preserves unexpected function after refusing '+corruption);
  equal(await currentData(),dataBefore,'108 refusal leaves witness business data unchanged '+corruption);
  await db.exec(oldPay.definition);
 }
 await db.exec(conflictSql);
 const patchedSave=await getProc(saveSignature);const patchedPay=await getProc(paySignature);
 equal(withoutSource(patchedSave.meta),withoutSource(oldSave.meta),'108 preserves commercial signature OID owner ACL search_path definer and all non-body metadata');
 equal(withoutSource(patchedPay.meta),withoutSource(oldPay.meta),'108 preserves payroll signature OID owner ACL search_path definer and all non-body metadata');
 equal(patchedSave.meta.prosrc,oldSave.meta.prosrc.replace("raise exception 'PRO_DOCUMENT_CHANGED' using errcode='40001';","raise exception 'PRO_DOCUMENT_CHANGED' using errcode='PT409';").replace("raise exception 'PRO_TAX_RATE_CHANGED' using errcode='40001';","raise exception 'PRO_TAX_RATE_CHANGED' using errcode='PT409';"),'108 changes only two exact commercial RAISE fragments');
 equal(patchedPay.meta.prosrc,oldPay.meta.prosrc.replace("raise exception 'PAYROLL_PERIOD_CHANGED' using errcode='40001';","raise exception 'PAYROLL_PERIOD_CHANGED' using errcode='PT409';"),'108 changes only the exact payroll RAISE fragment');
 await db.exec(conflictSql);
 equal(await getProc(saveSignature),patchedSave,'108 commercial reapplication is idempotent');equal(await getProc(paySignature),patchedPay,'108 payroll reapplication is idempotent');
 equal((await one("select pg_get_functiondef('public.convert_pro_quote_to_order_atomic(uuid,uuid)'::regprocedure) value")).value,otherBefore,'108 does not change the conversion function');
 equal(await currentData(),dataBefore,'108 successful patch and reapplication preserve witness business data');
 const privileges=await one("select has_function_privilege('authenticated',$1::regprocedure,'EXECUTE') auth,has_function_privilege('anon',$1::regprocedure,'EXECUTE') anon,has_function_privilege('service_role',$1::regprocedure,'EXECUTE') service",[saveSignature]);
 equal(privileges,{auth:true,anon:false,service:false},'108 retains authenticated-only commercial EXECUTE');
 const flagResult=await db.exec(conflictSql);equal(flagResult.at(-1).rows[0].pro_108_actif,true,'108 final installation indicator is true');
 async function rejectedHttp(run,label){
  await db.exec('savepoint expected_http_conflict');let error;
  try{await run();}catch(caught){error=caught;}finally{await db.exec('rollback to savepoint expected_http_conflict;release savepoint expected_http_conflict');}
  equal(error?.code,'PT409',label+' uses custom conflict SQLSTATE, not serialization40001');
 }
`;
let runtime=original.replace("(process.argv.includes('--installer')?'installer-':'database-')","'conflict-108-'").replace(marker,extension+'\n'+marker);
const replacements=[
 ["await rejected(()=>save(kind,id,version),/PRO_DOCUMENT_CHANGED/,kind+' stale version cannot overwrite newer draft');","await rejectedHttp(()=>save(kind,id,version),kind+' stale version');"],
 ["await rejected(()=>save('quote',null,null,[{...line,tax_rate_id:vat.id,tax_rate:0}]),/PRO_TAX_RATE_CHANGED/,'Referenced VAT cannot be overridden by payload');","await rejectedHttp(()=>save('quote',null,null,[{...line,tax_rate_id:vat.id,tax_rate:0}]),'Referenced VAT changed');"],
 ["await rejected(()=>prepare(oldVersion),/PAYROLL_PERIOD_CHANGED/,'Second stale payroll request refuses');","await rejectedHttp(()=>prepare(oldVersion),'Payroll period changed');"],
];
for(const[needle,extra]of replacements){if(runtime.split(needle).length!==2)throw Error('Review changed conflict case');runtime=runtime.replace(needle,needle+'\n '+extra);}
runtime=runtime.replace("scope:'Actual105/106 and104/099 guards in disposable PGlite.","scope:'Actual108 after105–107, exact metadata/definition checks, transactional rollback, PT409 SQLSTATE, and105/106 business regressions in disposable PGlite.");
const temporary=join(folder,'.conflict-runtime-'+randomUUID()+'.mjs');
try{await writeFile(temporary,runtime);await import(pathToFileURL(temporary).href);}finally{await rm(temporary,{force:true});}
