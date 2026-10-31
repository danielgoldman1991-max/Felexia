/* eslint-disable @typescript-eslint/no-require-imports -- Explicit Node CommonJS recette entry point. */
// Real actions and public JWTs, restricted to the prepared fictitious company.
// Run after business/boundaries/team and before corrections/supplier-credit.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifestPath=process.argv.find(arg=>arg.startsWith('--manifest='))?.slice(11);
if(!manifestPath || !process.argv.includes('--execute-qa'))throw new Error('Explicit private manifest and --execute-qa required');
require('@next/env').loadEnvConfig(root);
const {createClient}=require('@supabase/supabase-js');const {createActionRunner}=require('./essential-action-runner.cjs');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !m.run?.startsWith('essential-final-') || !m.organizationId || !m.records?.bankId)throw new Error('Prepared fictitious company and completed base business required');
if(typeof m.authorizedMailbox!=='string' || !m.authorizedMailbox.includes('@'))throw new Error('Authorized mailbox required privately');
const [mailboxName,mailboxDomain]=m.authorizedMailbox.toLowerCase().split('@');
for(const role of ['admin','operator','viewer']){const email=(m.users?.[role]?.email || '').toLowerCase();const prefix=mailboxName+'+recette';const suffix=role+'@'+mailboxDomain;if(!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length,-suffix.length)))throw new Error('Only authorized recette aliases may be used');}
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!key || key.startsWith('sb_secret_'))throw new Error('Public project key required');
const output=path.join(root,'training/essential-fixes/20261031/company-treasury.json');
const report={date:new Date().toISOString(),run:m.run,phase:'treasury',companyName:m.companyName,checks:[],diagnostics:[]};
m.treasuryTest ||= {};const t=m.treasuryTest;const clients={};let actor='admin';const runner=createActionRunner(()=>clients[actor],report.diagnostics);
const file='src/lib/treasury-actions.ts';const today=new Date().toISOString().slice(0,10);
function save(){fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function safe(value){return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').slice(0,250);}
function check(name,passed,observed){report.checks.push({name,passed:Boolean(passed),...(observed===undefined?{}:{observed})});if(!passed)throw new Error('QA_CHECK_FAILED: '+name);}
async function read(query,name){const result=await query;check(name+' query',!result.error,result.error?.code);return result.data;}
async function login(role){actor=role;const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients[role]=db;const signed=await db.auth.signInWithPassword({email:m.users[role].email,password:m.users[role].password});check(role+' authentication',!signed.error);const workspace=await runner.load('src/lib/auth.ts').getActiveWorkspace();check(role+' exact company',workspace?.organization.id===m.organizationId && workspace?.organization.name===m.companyName);}
async function action(name,payload,expected=true){const response=await runner.invoke(file,name,payload);const ok=typeof response.redirect==='string'?response.redirect.startsWith('/tresorerie/'):Boolean(response.result?.success===true && !response.result.error);check(actor+' '+name+(expected?'':' denied'),expected?ok:!ok,response.result?.error?safe(response.result.error):undefined);return response;}
const idFrom=response=>(response.redirect || '').match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
async function balances(bank,cash,label){const rows=await read(clients.admin.from('treasury_accounts').select('id,current_balance,currency').eq('organization_id',m.organizationId).in('id',[m.records.bankId,t.cashAccountId]),label);check(label,rows.length===2 && rows.every(row=>row.currency==='MAD') && Number(rows.find(row=>row.id===m.records.bankId).current_balance)===bank && Number(rows.find(row=>row.id===t.cashAccountId).current_balance)===cash);}
async function main(){
  for(const role of ['admin','operator','viewer'])await login(role);actor='admin';
  if(!t.cashAccountId){t.cashAccountId=idFrom(await action('createTreasuryAccount',{name:'Caisse de recette temporaire MAD',code:'QA-CAISSE',account_type:'cash',currency:'MAD',opening_balance:0}));save();}
  check('recette cash account exists',Boolean(t.cashAccountId));
  const manual={treasury_account_id:t.cashAccountId,operation_mode:'movement',transaction_type:'manual_in',direction:'in',amount:5,label:'Entrée manuelle fictive de recette',transaction_date:today};
  t.manualKey ||= crypto.randomUUID();save();manual.idempotency_key=t.manualKey;
  if(!t.manualArchived){
    if(!t.manualTransactionId){t.manualTransactionId=idFrom(await action('createManualTreasuryTransaction',manual));save();}
    try{
      await balances(120,5,'manual movement adds exactly5 to cash');
      const replay=await action('createManualTreasuryTransaction',manual);check('manual movement idempotent replay preserves identity',idFrom(replay)===t.manualTransactionId);await balances(120,5,'manual replay creates no second amount');
      for(const role of ['operator','viewer']){actor=role;await action('createManualTreasuryTransaction',{...manual,idempotency_key:crypto.randomUUID()},false);await action('archiveTreasuryTransaction',{id:t.manualTransactionId},false);}
    }finally{actor='admin';await action('archiveTreasuryTransaction',{id:t.manualTransactionId});}
    const archived=await read(clients.admin.from('treasury_transactions').select('archived_at').eq('organization_id',m.organizationId).eq('id',t.manualTransactionId).single(),'archived manual movement');check('manual movement is retained in archive',Boolean(archived.archived_at));
    await balances(120,0,'manual archive restores cash to0');await action('archiveTreasuryTransaction',{id:t.manualTransactionId});await balances(120,0,'manual archive is idempotent');t.manualArchived=true;save();
  }
  if(!t.transfersCompleted){
    const forward={treasury_account_id:m.records.bankId,destination_account_id:t.cashAccountId,operation_mode:'transfer',amount:10,label:'Transfert fictif banque vers caisse',transaction_date:today};
    await action('createManualTreasuryTransaction',{...forward,destination_account_id:m.records.bankId,idempotency_key:crypto.randomUUID()},false);
    await action('createManualTreasuryTransaction',{...forward,amount:0,idempotency_key:crypto.randomUUID()},false);
    for(const role of ['operator','viewer']){actor=role;await action('createManualTreasuryTransaction',{...forward,idempotency_key:crypto.randomUUID()},false);}actor='admin';
    t.forwardKey ||= crypto.randomUUID();t.reverseKey ||= crypto.randomUUID();save();
    forward.idempotency_key=t.forwardKey;
    const reverse={...forward,treasury_account_id:t.cashAccountId,destination_account_id:m.records.bankId,label:'Correction par transfert inverse de recette',idempotency_key:t.reverseKey};
    if(!t.forwardOutgoingId){t.forwardOutgoingId=idFrom(await action('createManualTreasuryTransaction',forward));save();}
    try{
      if(!t.reverseOutgoingId){await balances(110,10,'forward transfer moves10 between accounts');const replay=await action('createManualTreasuryTransaction',forward);check('forward transfer replay retains identity',idFrom(replay)===t.forwardOutgoingId);await balances(110,10,'transfer replay does not double balances');}
      await action('archiveTreasuryTransaction',{id:t.forwardOutgoingId},false);
    }finally{
      actor='admin';if(!t.reverseOutgoingId){t.reverseOutgoingId=idFrom(await action('createManualTreasuryTransaction',reverse));save();}
    }
    const replay=await action('createManualTreasuryTransaction',reverse);check('reverse transfer replay retains identity',idFrom(replay)===t.reverseOutgoingId);await balances(120,0,'inverse transfer restores bank120 and cash0');
    t.transferGroupIds=[t.forwardKey,t.reverseKey];const transfers=await read(clients.admin.from('treasury_transactions').select('id,transfer_group_id,direction,amount,archived_at').eq('organization_id',m.organizationId).in('transfer_group_id',t.transferGroupIds),'audited forward and inverse pairs');
    check('two complete transfer pairs remain active in audit history',transfers.length===4 && transfers.every(row=>!row.archived_at && Number(row.amount)===10) && t.transferGroupIds.every(group=>transfers.filter(row=>row.transfer_group_id===group && row.direction==='in').length===1 && transfers.filter(row=>row.transfer_group_id===group && row.direction==='out').length===1));
    t.transactionIds=transfers.map(row=>row.id);t.transfersCompleted=true;save();
  }
  actor='admin';await balances(120,0,'final treasury balances match base business');
  if(!t.cashArchived){await action('archiveTreasuryAccount',{id:t.cashAccountId});t.cashArchived=true;save();}
  const cash=await read(clients.admin.from('treasury_accounts').select('status,archived_at,current_balance').eq('organization_id',m.organizationId).eq('id',t.cashAccountId).single(),'archived cash account');check('empty test cash account is archived without deletion',cash.status==='archived' && Boolean(cash.archived_at) && Number(cash.current_balance)===0);
  actor='viewer';const consultation=await runner.load('src/lib/treasury.ts').listTreasuryConsultationFlows({});check('consultation includes internal audit pairs without changing net120',consultation.summary.total_in===260 && consultation.summary.total_out===140 && consultation.summary.net_flow===120);
  report.financial={bankBalance:120,cashBalance:0,manualArchived:true,transferPairs:2,internalTransferPerDirection:20,totalIn:260,totalOut:140,net:120};report.success=true;save();console.log(JSON.stringify({success:true,checks:report.checks.length,report:output}));
}
main().catch(error=>{report.success=false;report.error=safe(error.message);save();console.error(JSON.stringify({success:false,checks:report.checks.length,error:report.error}));process.exitCode=1;});
