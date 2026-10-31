const fs = require('node:fs');
const projectRoot = require('node:path').resolve(__dirname, '../../..');
const vm = require('node:vm');
const ts = require(projectRoot+'/node_modules/typescript');
const source = fs.readFileSync(projectRoot+'/src/lib/stripe-webhook.ts','utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let event, writes = [], failDatabase = false;
const subscription = {id:'sub_fixture',status:'active',customer:'cus_fixture',metadata:{organization_id:'org_fixture',plan_code:'essentiel'},items:{data:[{price:{id:'price_fixture',recurring:{interval:'month'}},current_period_start:1793404800,current_period_end:1796083200}]}};
function db(table) {
  const q = {select(){return q},eq(){return q},maybeSingle(){return Promise.resolve({data:{id:'plan_fixture'},error:null})},
    insert(payload){writes.push({table,method:'insert',payload});return Promise.resolve({error:failDatabase?{message:'fixture database write failed'}:null})},
    upsert(payload){writes.push({table,method:'upsert',payload});return Promise.resolve({error:failDatabase?{message:'fixture database write failed'}:null})},
    update(payload){writes.push({table,method:'update',payload});return {eq(){return Promise.resolve({error:failDatabase?{message:'fixture database write failed'}:null})}}}};
  return q;
}
const supabase={from:db};
const stripe={webhooks:{constructEvent(){return event}},subscriptions:{async retrieve(){return subscription}}};
const moduleObject={exports:{}};
const sandbox={exports:moduleObject.exports,module:moduleObject,process:{env:{STRIPE_WEBHOOK_SECRET:'whsec_fixture'}},require(name){
  if(name==='@/lib/stripe') return {getStripe:()=>stripe};
  if(name==='@/lib/subscriptions/plans')return {normalizePlanCode:value=>value||'essentiel'};
  if(name==='@/lib/subscriptions/stripe-prices')return {getPlanCodeFromPriceId:()=> 'essentiel'};
  if(name==='@/lib/supabase/service')return {createClient:()=>supabase};
  throw new Error('Unexpected dependency '+name);
}};
vm.runInNewContext(compiled,sandbox,{filename:'stripe-webhook.ts'});
const handle=moduleObject.exports.handleStripeWebhook;
async function probe(type,object,{fail=false}={}){
  writes=[];failDatabase=fail;event={id:'evt_fixture',type,data:{object}};
  const result=await handle('fixture signed payload','fixture signature');
  return {result,writes};
}
(async()=>{
  const checkout=await probe('checkout.session.completed',{metadata:{organization_id:'org_fixture',plan_code:'essentiel'},subscription:'sub_fixture',customer:'cus_fixture'});
  const stored=checkout.writes.find(w=>w.table==='organization_subscriptions'&&w.method==='upsert').payload;
  const invoice={parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}}};
  const paid=await probe('invoice.paid',invoice);
  const failed=await probe('invoice.payment_failed',invoice);
  const dbFailure=await probe('customer.subscription.updated',subscription,{fail:true});
  console.log(JSON.stringify({scope:'Local VM; real handler source with fixture-only Stripe and DB boundaries; no network',sdkApiVersion:require(projectRoot+'/node_modules/stripe/cjs/apiVersion.js').ApiVersion,observations:[
    {name:'New SDK subscription item periods are discarded',confirmed:stored.current_period_start===null&&stored.current_period_end===null,actual:{start:stored.current_period_start,end:stored.current_period_end}},
    {name:'Modern invoice.paid returns success without updating subscription',confirmed:paid.result.received===true&&paid.writes.filter(w=>w.table==='organization_subscriptions').length===0},
    {name:'Modern invoice.payment_failed returns success without updating subscription',confirmed:failed.result.received===true&&failed.writes.filter(w=>w.table==='organization_subscriptions').length===0},
    {name:'Database write errors are acknowledged as successfully received',confirmed:dbFailure.result.received===true&&dbFailure.writes.some(w=>w.table==='stripe_events'&&w.payload.processed===true)}]},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
