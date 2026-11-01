/* Read-only readiness metadata. Never print keys, record IDs, customers or raw provider errors. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../../..');
const vars={};
for(const file of ['.env.stripe-test.local','.env.local','.env']){
 const target=path.join(root,file);if(!fs.existsSync(target))continue;
 for(const line of fs.readFileSync(target,'utf8').split(/\r?\n/)){
  const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!match||vars[match[1]])continue;
  vars[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
 }
}
async function run(){
 const report={at:new Date().toISOString(),scope:'Read-only local credential capabilities and hosted API schema names; no business mutation, email or payment.',stripe:{productionKeyPresent:/^sk_live_/.test(vars.STRIPE_SECRET_KEY||''),testKeyAvailable:Object.entries(vars).some(([k,v])=>/STRIPE/.test(k)&&/^sk_test_/.test(v)),paidLifecycleExecuted:false},database:{directConnectionConfigured:Object.keys(vars).some(k=>/^(DATABASE_URL|SUPABASE_DB_URL|DIRECT_URL)$/.test(k)&&vars[k]),managementTokenConfigured:!!vars.SUPABASE_ACCESS_TOKEN,restoreExecuted:false},schema:{}};
 if(vars.NEXT_PUBLIC_SUPABASE_URL&&vars.SUPABASE_SERVICE_ROLE_KEY){
  const response=await fetch(vars.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/',{headers:{apikey:vars.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+vars.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(20000)});
  report.schema.status=response.status;
  if(response.ok){const schema=await response.json();report.schema.note='Service-role OpenAPI visibility only; revoked EXECUTE can hide an installed RPC. Verify authenticated capabilities separately after manual installation.';for(const name of ['save_pro_commercial_document_atomic','prepare_hr_payroll_atomic','set_default_treasury_account_atomic','save_default_treasury_account_atomic','pro_transaction_capabilities'])report.schema[name]=!!schema.paths?.['/rpc/'+name];}
 }
 fs.writeFileSync(path.join(__dirname,'readiness.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
run().catch(()=>{console.error('Readiness metadata check failed; no private provider response logged.');process.exitCode=1;});
