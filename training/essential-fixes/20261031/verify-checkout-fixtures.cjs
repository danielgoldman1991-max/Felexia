/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS VM fixture loader */
// Test real route modules with synthetic identity/Stripe/database boundaries.
// This does not create a Stripe customer, checkout, portal or charge.
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');const ts=require(root+'/node_modules/typescript');
let workspace,configured,price,lease,customerId,customerOrganization,subscriptions,openSessions,saveError;
let calls;
const org='10000000-0000-4000-8000-000000000001';
function reset(){workspace={organization:{id:org,name:'Synthetic QA'},email:'admin@example.test',role:'admin'};configured=true;price='price_fixture';lease='lease_fixture';customerId='cus_fixture';customerOrganization=org;subscriptions=[];openSessions=[];saveError=false;calls={checkout:0,portal:0,customer:0,expired:0,released:0};}
const service={async rpc(name){if(name==='claim_billing_checkout')return {data:lease,error:null};if(name==='release_billing_checkout'){calls.released++;return {data:null,error:null};}throw Error('Unexpected RPC');},from(){const q={select(){return q},eq(){return q},update(){return q},single:async()=>({data:{stripe_customer_id:customerId,name:'Synthetic QA'},error:null}),then(resolve){return Promise.resolve({error:saveError?{code:'fixture'}:null}).then(resolve)}};return q;}};
const stripe={customers:{retrieve:async()=>({id:customerId,metadata:{organization_id:customerOrganization}})},subscriptions:{list:async()=>({data:subscriptions,has_more:false})},checkout:{sessions:{list:async()=>({data:openSessions,has_more:false}),expire:async()=>{calls.expired++;return {};}}}};
const fixtures={
  'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
  '@/lib/auth':{getActiveWorkspace:async()=>workspace},
  '@/lib/supabase/service':{createClient:()=>service},
  '@/lib/stripe':{getStripe:()=>stripe,getStripePriceIdForPlan:()=>price,createStripeCustomer:async()=>{calls.customer++;return {id:'cus_created'}},createPlanCheckoutSession:async()=>{calls.checkout++;return {url:'https://checkout.stripe.test/fixture'}},createPortalSession:async()=>{calls.portal++;return {url:'https://billing.stripe.test/fixture'}}},
  '@/lib/env':{hasStripeEnv:()=>configured},
  '@/lib/subscriptions/commercial-offers':{isPlanPubliclyAvailable:p=>p==='essentiel'},
  '@/lib/auth/roles':{isAdminRole:r=>['admin','owner'].includes(r),isOperatorRole:r=>r==='operator'},
  '@/lib/auth/operator-access':{OPERATOR_ACCESS_ERROR:'operator denied'},
};
function route(filename){const target={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(root,filename),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{module:target,exports:target.exports,console:{error(){}},require:name=>{if(fixtures[name])return fixtures[name];throw Error('Unexpected dependency '+name)}});return target.exports;}
const checkout=route('src/app/api/stripe/checkout/route.ts');const portal=route('src/app/api/stripe/portal/route.ts');
const request=(interval='monthly',plan='essentiel')=>({json:async()=>({planCode:plan,billingInterval:interval})});const results=[];function ok(value,name){assert.equal(value,true,name);results.push(name);}
async function main(){
  reset();workspace=null;ok((await checkout.POST(request())).status===401,'Anonymous checkout denied');ok(calls.checkout===0,'No checkout before authentication');
  reset();workspace.role='viewer';ok((await checkout.POST(request())).status===403,'Viewer checkout denied');ok((await portal.POST()).status===403,'Viewer portal denied');
  reset();workspace.role='operator';ok((await checkout.POST(request())).body.code==='OPERATOR_ACCESS_DENIED','Operator checkout denied explicitly');
  reset();ok((await checkout.POST(request('monthly','premium'))).status===400,'Non-public plan cannot be purchased');
  reset();ok((await checkout.POST(request('invalid'))).status===400,'Invalid cycle rejected');
  reset();configured=false;ok((await checkout.POST(request())).status===503,'Missing Stripe configuration is explicit');
  reset();price=null;ok((await checkout.POST(request())).status===503,'Missing price is explicit');
  reset();lease=null;ok((await checkout.POST(request())).status===409,'Concurrent company checkout cannot start twice');ok(calls.checkout===0,'Busy lease has no checkout side effect');
  reset();subscriptions=[{status:'active'}];ok((await checkout.POST(request('yearly'))).body.destination==='portal','Existing paid cycle changes use portal');ok(calls.checkout===0&&calls.portal===1,'Existing subscription cannot create a second checkout');
  reset();subscriptions=[{status:'incomplete'}];ok((await checkout.POST(request())).body.destination==='portal','An unfinished paid subscription is recovered through portal');
  reset();subscriptions=[{status:'canceled'}];ok((await checkout.POST(request())).status===200&&calls.checkout===1,'Canceled subscription can subscribe again');ok(calls.released===1,'Checkout lease released after success');
  reset();openSessions=[{id:'cs_open',mode:'subscription',metadata:{organization_id:org,plan_code:'essentiel',billing_cycle:'monthly'},url:'https://checkout.stripe.test/open'}];ok((await checkout.POST(request())).body.url.endsWith('/open'),'Existing open checkout is reused');ok(calls.checkout===0,'Reusing checkout does not create another');
  reset();openSessions=[{id:'cs_open',mode:'subscription',metadata:{organization_id:org,plan_code:'essentiel',billing_cycle:'monthly'},url:'https://checkout.stripe.test/open'}];await checkout.POST(request('yearly'));ok(calls.expired===1&&calls.checkout===1,'Changing an unpaid checkout expires the earlier cycle');
  reset();customerOrganization='foreign_org';ok((await checkout.POST(request())).status===503,'Foreign Stripe customer mapping rejected');ok(calls.checkout===0&&calls.portal===0,'Foreign customer never opens checkout or portal');ok(calls.released===1,'Checkout lease released after failure');ok((await portal.POST()).status===503,'Portal also checks customer ownership');
  reset();customerId=null;saveError=true;ok((await checkout.POST(request())).status===503&&calls.checkout===0,'Customer persistence failure cannot continue to checkout');
  fs.writeFileSync(path.join(__dirname,'checkout-fixture-tests.json'),JSON.stringify({success:true,checks:results.length,scope:'Real routes; fixture-only identity, database and Stripe; no network or charges',results},null,2));console.log(JSON.stringify({success:true,checks:results.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
