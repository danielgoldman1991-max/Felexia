/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS VM fixture loader */
// Real modules, fixture-only external boundaries. No environment files/network.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(root + '/node_modules/typescript');
const compile = filename => ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let currentEvent, failAt = null, retrieveCount = 0, writes = [];
const records = new Map();
const subscription = {id:'sub_fixture',status:'active',customer:'cus_fixture',metadata:{organization_id:'10000000-0000-4000-8000-000000000001',plan_code:'essentiel'},items:{data:[{price:{id:'price_fixture',recurring:{interval:'month'}},current_period_start:1793404800,current_period_end:1796083200}]}};
const service = {
  async rpc(name, args) {
    if (failAt === name) return {data:null,error:{code:'fixture_write_error'}};
    if (name === 'claim_stripe_event') {
      const existing = records.get(args.p_event_id);
      if (existing?.processed) return {data:'processed',error:null};
      if (existing?.processing) return {data:'processing',error:null};
      records.set(args.p_event_id,{processing:true,processed:false});
      return {data:'claimed',error:null};
    }
    if (name === 'apply_stripe_subscription') {writes.push(args); return {data:true,error:null};}
    throw Error('Unexpected fixture RPC');
  },
  from(table) {
    let payload, eventId;
    const q = {
      select(){return q},eq(_key,value){eventId=value;return q},
      update(value){payload=value;return q},
      maybeSingle(){return Promise.resolve({data:{organization_id:subscription.metadata.organization_id},error:null})},
      single(){return Promise.resolve(finish())},
      then(resolve,reject){return Promise.resolve(finish()).then(resolve,reject)},
    };
    function finish() {
      if (table !== 'stripe_events') throw Error('Unexpected fixture table');
      if (failAt === 'complete' && payload?.processed === true) return {data:null,error:{code:'fixture_complete_error'}};
      records.set(eventId,{processing:false,processed:payload?.processed === true});
      return {data:{id:'event_fixture'},error:null};
    }
    return q;
  }
};
const stripe = {webhooks:{constructEvent(_body,signature){if(signature!=='valid') throw Error('fixture signature');return currentEvent;}},subscriptions:{async retrieve(){retrieveCount++;return subscription;}}};
function load(source, requireFixture, extra={}) {
  const target={exports:{}};
  const context={module:target,exports:target.exports,require:requireFixture,process:{env:{STRIPE_WEBHOOK_SECRET:'whsec_fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture_signing_secret'}},console:{error(){}},Buffer,Date,...extra};
  vm.runInNewContext(source,context);return target.exports;
}
const webhook=load(compile('src/lib/stripe-webhook.ts'),name=>{
  if(name==='@/lib/stripe')return {getStripe:()=>stripe};
  if(name==='@/lib/subscriptions/plans')return {normalizePlanCode:v=>v};
  if(name==='@/lib/subscriptions/stripe-prices')return {getPlanCodeFromPriceId:()=> 'essentiel'};
  if(name==='@/lib/supabase/service')return {createClient:()=>service};
  throw Error('Unexpected dependency '+name);
});
let number=0;
function event(type,object){currentEvent={id:'evt_fixture_'+ ++number,type,created:1793404800+number,data:{object}};return currentEvent.id;}
const results=[];
function ok(value,name){assert.equal(value,true,name);results.push(name);}
async function rejects(run,name){await assert.rejects(run);results.push(name);}
async function main(){
  let id=event('checkout.session.completed',{mode:'subscription',metadata:{organization_id:subscription.metadata.organization_id},subscription:subscription.id});
  await webhook.handleStripeWebhook('{}','valid');
  ok(writes.at(-1).p_payload.current_period_start==='2026-10-31T00:00:00.000Z','Modern subscription item start preserved');
  ok(writes.at(-1).p_payload.current_period_end==='2026-12-01T00:00:00.000Z','Modern subscription item end preserved');
  ok(records.get(id).processed,'Completion is persisted');
  let count=retrieveCount;await webhook.handleStripeWebhook('{}','valid');ok(retrieveCount===count,'Duplicate processed event has no side effects');
  event('invoice.paid',{parent:{subscription_details:{subscription:subscription.id}}});await webhook.handleStripeWebhook('{}','valid');ok(writes.at(-1).p_payload.status==='active','Modern invoice paid updates subscription');
  subscription.status='past_due';event('invoice.payment_failed',{parent:{subscription_details:{subscription:{id:subscription.id}}}});await webhook.handleStripeWebhook('{}','valid');ok(writes.at(-1).p_payload.status==='past_due','Modern failed invoice updates payment status');
  subscription.status='active';event('invoice.paid',{subscription:subscription.id});await webhook.handleStripeWebhook('{}','valid');ok(writes.at(-1).p_payload.status==='active','Legacy invoice reference remains compatible');
  subscription.status='canceled';event('customer.subscription.deleted',{id:subscription.id});await webhook.handleStripeWebhook('{}','valid');ok(writes.at(-1).p_payload.status==='canceled','Deleted subscription maps canceled state');subscription.status='active';
  failAt='apply_stripe_subscription';id=event('customer.subscription.updated',{id:subscription.id});await rejects(()=>webhook.handleStripeWebhook('{}','valid'),'Persistence failure is rejected for Stripe retry');ok(!records.get(id).processed,'Failed persistence never marks processed');failAt=null;await webhook.handleStripeWebhook('{}','valid');ok(records.get(id).processed,'Failed event can be retried successfully');
  failAt='complete';id=event('customer.subscription.updated',{id:subscription.id});await rejects(()=>webhook.handleStripeWebhook('{}','valid'),'Completion-marker failure is not acknowledged');ok(!records.get(id).processed,'Completion failure retains retry state');failAt=null;await webhook.handleStripeWebhook('{}','valid');ok(records.get(id).processed,'Completion retry succeeds');
  failAt='claim_stripe_event';event('customer.subscription.updated',{id:subscription.id});count=retrieveCount;await rejects(()=>webhook.handleStripeWebhook('{}','valid'),'Claim failure rejects before Stripe side effects');ok(retrieveCount===count,'No retrieve when event claim fails');failAt=null;
  id=event('customer.subscription.updated',{id:subscription.id});records.set(id,{processing:true,processed:false});await rejects(()=>webhook.handleStripeWebhook('{}','valid'),'Simultaneous processing asks Stripe to retry');
  event('customer.subscription.updated',{id:subscription.id});await rejects(()=>webhook.handleStripeWebhook('{}','invalid'),'Invalid signature rejected');
  const saved=subscription.items.data[0].current_period_end;delete subscription.items.data[0].current_period_end;await rejects(()=>webhook.handleStripeWebhook('{}','valid'),'Missing active billing period rejected');subscription.items.data[0].current_period_end=saved;

  let now=1000000;const store=new Map();
  const recovery=load(compile('src/lib/auth/recovery-session.ts'),name=>{
    if(name==='server-only')return {};
    if(name==='node:crypto')return crypto;
    if(name==='next/headers')return {cookies:async()=>({get:k=>store.has(k)?{value:store.get(k)}:undefined,set:(k,v)=>store.set(k,v),delete:k=>store.delete(k)})};
    throw Error('Unexpected recovery dependency');
  },{Date:{now:()=>now}});
  ok(!await recovery.canCompletePasswordRecovery('user_fixture'),'No reset without recovery proof');
  await recovery.allowPasswordRecovery('user_fixture');ok(await recovery.canCompletePasswordRecovery('user_fixture'),'Valid recovery proof accepted');
  ok(!await recovery.canCompletePasswordRecovery('other_user'),'Recovery is bound to the authenticated account');
  const cookie=store.get('felexia_recovery');store.set('felexia_recovery',cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0'));ok(!await recovery.canCompletePasswordRecovery('user_fixture'),'Tampered recovery signature rejected');store.set('felexia_recovery',cookie);
  now+=600001;ok(!await recovery.canCompletePasswordRecovery('user_fixture'),'Recovery proof expires after ten minutes');
  now-=600001;await recovery.clearPasswordRecovery();ok(!await recovery.canCompletePasswordRecovery('user_fixture'),'Successful reset can consume recovery proof');
  fs.writeFileSync(path.join(__dirname,'webhook-recovery-tests.json'),JSON.stringify({success:true,checks:results.length,scope:'Real TypeScript modules; synthetic Stripe/DB/cookies; no network/project environment',results},null,2));
  console.log(JSON.stringify({success:true,checks:results.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
