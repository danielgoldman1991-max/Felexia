/* eslint-disable @typescript-eslint/no-require-imports -- real SDK protocol fixture, no network */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sdk = require('@supabase/ssr');
const { NextRequest, NextResponse } = require('next/server');
const root = path.resolve(__dirname, '../../..');
const supabaseUrl = 'https://oauth-fixture.supabase.invalid';
const userId = '10000000-0000-4000-8000-000000000001';
const target = '/parametres/abonnement?plan=pro&billing=yearly';
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push(name); }
function noStore(response) { return /private.*no-store/.test(response.headers.get('cache-control'))&&response.headers.get('pragma')==='no-cache'&&response.headers.get('expires')==='0'; }
let behavior = 'normal', callbackCookieStore, profileCalls = 0, tokenRequests = 0;
let writtenCallbackCookies = [], safeLogs = [];
const grants = new Map();
const challenge = verifier => crypto.createHash('sha256').update(verifier).digest('base64url');
function session() {
  const now = Math.floor(Date.now()/1000);
  const access = [Buffer.from(JSON.stringify({ alg:'HS256',typ:'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub:userId,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600 })).toString('base64url'),
    Buffer.from('isolated-fixture-signature').toString('base64url')].join('.');
  return { access_token:access, token_type:'bearer', expires_in:3600, refresh_token:'isolated-fixture-refresh-token',
    user:{ id:userId,aud:'authenticated',role:'authenticated',email:'oauth@example.invalid',app_metadata:{provider:'google'},user_metadata:{},created_at:'2026-01-01T00:00:00Z' } };
}
async function transport(input, init) {
  const url = new URL(String(input));
  assert.equal(url.origin, supabaseUrl, 'No unplanned host is contacted');
  assert.equal(url.pathname, '/auth/v1/token', 'Only a token request is simulated');
  assert.equal(url.searchParams.get('grant_type'), 'pkce');
  tokenRequests++;
  const body = JSON.parse(init.body);
  const expected = grants.get(body.auth_code);
  if (!expected || expected.used || challenge(body.code_verifier) !== expected.challenge) {
    return Response.json({code:'bad_code_verifier',msg:'Fixture code cannot be exchanged.'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}});
  }
  expected.used = true;
  return Response.json(session());
}
const env = { requireSupabasePublicEnv: () => ({supabaseUrl,supabaseAnonKey:'isolated-public-fixture'}) };
const realSdk = { createServerClient(url,key,options) {
  const client = sdk.createServerClient(url,key,{...options,global:{fetch:transport}});
  if (behavior === 'provider-error') client.auth.signInWithOAuth = async () => ({data:{url:null},error:{code:'fixture_failure'}});
  if (behavior === 'foreign-provider') client.auth.signInWithOAuth = async () => ({data:{url:'https://evil.invalid/collect'},error:null});
  return client;
} };
const safeConsole = {error:(...args)=>safeLogs.push(args),info:(...args)=>safeLogs.push(args),warn:(...args)=>safeLogs.push(args)};
const cache = new Map();
const modules = {
  '@supabase/ssr':realSdk,
  'next/server':{NextRequest,NextResponse},
  'next/headers':{cookies:async()=>callbackCookieStore},
  '@/lib/env':env,
  '@/lib/auth/ensure-profile-from-auth-user':{ensureProfileFromAuthUser:async()=>{profileCalls++;return {ok:true};}},
  '@/lib/auth/resolve-authenticated-user-redirect':{resolveAuthenticatedUserRedirect:async()=>'/dashboard'},
  '@/lib/auth/recovery-session':{allowPasswordRecovery:async()=>{throw Error('Unplanned recovery');}},
};
let clientOrigin='https://www.felexia.pro', assigned;
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(output,{exports,URL,Map,console:safeConsole,window:{location:{get origin(){return clientOrigin;},assign:url=>{assigned=url;}}},require:name=>{
    if(modules[name])return modules[name];
    if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');
    throw Error('Unexpected import '+name);
  }});
  cache.set(relative,exports);return exports;
}
const start = load('src/app/auth/google/route.ts');
const callback = load('src/app/auth/callback/route.ts');
const browser = load('src/lib/auth/google-auth.ts');
class Jar {
  constructor(){this.values=new Map();}
  apply(response, origin){for(const c of response.cookies.getAll()){const key=origin+'|'+c.name;if(c.maxAge===0||c.value==='')this.values.delete(key);else this.values.set(key,{...c,origin});}}
  cookieHeader(origin){return [...this.values.values()].filter(c=>c.origin===origin).map(c=>c.name+'='+c.value).join('; ');}
  request(url){const origin=new URL(url).origin;return new NextRequest(url,{headers:{cookie:this.cookieHeader(origin),'x-forwarded-host':'evil.invalid'}});}
}
async function open(jar, origin='https://www.felexia.pro', query='?next='+encodeURIComponent(target)+'&mode=register') {
  const response=await start.GET(jar.request(origin+'/auth/google'+query));
  const to=new URL(response.headers.get('location'));
  jar.apply(response,origin);
  return {response,to,origin};
}
async function complete(jar, origin, code) {
  const request=jar.request(origin+'/auth/callback?code='+encodeURIComponent(code));
  const values=new Map(request.cookies.getAll().map(c=>[c.name,c.value]));
  writtenCallbackCookies=[];
  callbackCookieStore={getAll:()=>[...values].map(([name,value])=>({name,value})),set:(name,value,options)=>{
    values.set(name,value);writtenCallbackCookies.push({name,value,...options});
  }};
  const response=await callback.GET(request);
  for(const c of writtenCallbackCookies)response.cookies.set(c);
  jar.apply(response,origin);
  return response;
}
function grant(flow, code) {grants.set(code,{challenge:flow.to.searchParams.get('code_challenge'),used:false});}
async function main(){
  await browser.signInWithGoogle({next:target,mode:'register'});
  const navigation=new URL(assigned);
  check('Browser opens a same-origin server route before creating a verifier',navigation.origin===clientOrigin&&navigation.pathname==='/auth/google');
  check('Browser preserves next and registration mode',navigation.searchParams.get('next')===target&&navigation.searchParams.get('mode')==='register');
  for(const origin of ['https://www.felexia.pro','https://felexia.pro','https://preview.example.invalid','http://localhost:3112']){
    clientOrigin=origin;await browser.signInWithGoogle({next:'//evil.invalid',mode:'login'});
    check('Browser cannot send an external next on '+origin,new URL(assigned).origin===origin&&new URL(assigned).searchParams.get('next')==='/dashboard');
    const jar=new Jar(),flow=await open(jar,origin);
    const redirect=new URL(flow.to.searchParams.get('redirect_to'));
    check('Server returns a temporary redirect on '+origin,flow.response.status===307);
    check('Server callback uses exact reached origin, ignoring forwarded host: '+origin,redirect.origin===origin&&redirect.pathname==='/auth/callback');
    check('Server callback preserves offer and mode: '+origin,redirect.searchParams.get('next')===target&&redirect.searchParams.get('mode')==='register');
    check('Real SDK produces S256: '+origin,flow.to.searchParams.get('code_challenge_method')==='s256'&&Boolean(flow.to.searchParams.get('code_challenge')));
    const written=flow.response.cookies.getAll();
    check('Verifier is in effective Set-Cookie before leaving: '+origin,written.some(c=>c.name.endsWith('-code-verifier')&&c.value)&&flow.response.headers.has('set-cookie'));
    check('Verifier cookie is host-only, path root and SameSite lax: '+origin,written.every(c=>!c.domain&&c.path==='/'&&c.sameSite==='lax'));
    check('OAuth start is explicitly private and never cached: '+origin,/private.*no-store/.test(flow.response.headers.get('cache-control')));
    grant(flow,'isolated-valid-'+origin);
    const success=await complete(jar,origin,'isolated-valid-'+origin);
    check('Real SDK exchanges matching verifier and reaches dashboard: '+origin,success.headers.get('location')===origin+'/dashboard');
    check('Successful OAuth callback is private and never cached: '+origin,noStore(success));
    check('Session cookie is emitted after token exchange: '+origin,success.cookies.getAll().some(c=>c.name.includes('auth-token')&&!c.name.endsWith('code-verifier')&&c.value));
    const before=profileCalls,requests=tokenRequests;
    const replay=await complete(jar,origin,'isolated-valid-'+origin);
    check('Replayed callback cannot reuse an existing authenticated session: '+origin,new URL(replay.headers.get('location')).searchParams.get('error')==='google_auth_failed'&&profileCalls===before);
    check('Failed/replayed OAuth callback is private and never cached: '+origin,noStore(replay));
    check('Missing verifier is rejected before token transport: '+origin,tokenRequests===requests);
  }
  const empty=new Jar(), before=profileCalls, requests=tokenRequests;
  const absent=await complete(empty,'https://www.felexia.pro','isolated-no-verifier');
  check('A missing verifier never initializes a profile or session',new URL(absent.headers.get('location')).searchParams.get('error')==='google_auth_failed'&&profileCalls===before&&tokenRequests===requests);
  const double=new Jar(),first=await open(double),second=await open(double);
  check('Two starts create different PKCE challenges',first.to.searchParams.get('code_challenge')!==second.to.searchParams.get('code_challenge'));
  grant(first,'isolated-older-flow');
  const mismatch=await complete(double,first.origin,'isolated-older-flow');
  check('An older flow with the overwritten verifier fails closed',new URL(mismatch.headers.get('location')).searchParams.get('error')==='google_auth_failed'&&profileCalls===before);
  const restarted=await open(double);grant(restarted,'isolated-fresh-flow');
  check('A fresh attempt recovers after concurrent starts',(await complete(double,restarted.origin,'isolated-fresh-flow')).headers.get('location')===restarted.origin+'/dashboard');
  for(const bad of ['provider-error','foreign-provider']){
    behavior=bad;const result=await open(new Jar());
    check('Provider failure/foreign URL returns only to local login: '+bad,result.to.origin===result.origin&&result.to.pathname==='/login'&&result.to.searchParams.get('error')==='google_auth_failed');
    check('Failure retains sanitized continuation and mode: '+bad,result.to.searchParams.get('next')===target&&result.to.searchParams.get('mode')==='register');
  }
  behavior='normal';
  const hostile=await open(new Jar(),'https://www.felexia.pro','?next='+encodeURIComponent('https://evil.invalid')+'&mode=invalid');
  const bounded=new URL(hostile.to.searchParams.get('redirect_to'));
  check('Server independently rejects unsafe next and invalid mode',bounded.searchParams.get('next')==='/dashboard'&&!bounded.searchParams.has('mode'));
  const denied=await callback.GET(new NextRequest('https://www.felexia.pro/auth/callback?error=access_denied&next='+encodeURIComponent(target)+'&mode=register'));
  const retry=new URL(denied.headers.get('location'));
  check('Cancelled Google callback keeps registration mode and chosen offer on retry',retry.searchParams.get('mode')==='register'&&retry.searchParams.get('next')===target&&retry.searchParams.get('error')==='access_denied');
  const invalidMode=await callback.GET(new NextRequest('https://www.felexia.pro/auth/callback?error=access_denied&mode=invalid'));
  check('Callback retry does not propagate an invalid mode',!new URL(invalidMode.headers.get('location')).searchParams.has('mode'));
  check('Provider denial redirects are private and never cached',noStore(denied));
  const missingCode=await callback.GET(new NextRequest('https://www.felexia.pro/auth/callback'));
  check('Missing code redirects are private and never cached',noStore(missingCode)&&new URL(missingCode.headers.get('location')).searchParams.get('error')==='missing_oauth_code');
  for(const query of ['?recovery=1&error=access_denied','?recovery=1']){
    const recovery=await callback.GET(new NextRequest('https://www.felexia.pro/auth/callback'+query));
    check('Recovery redirects are private and never cached: '+query,noStore(recovery)&&new URL(recovery.headers.get('location')).pathname==='/reinitialiser-mot-de-passe');
  }
  const logs=JSON.stringify(safeLogs);
  check('Logs never contain auth codes, verifier, refresh token or provider URL',!logs.includes('isolated-valid-')&&!logs.includes('isolated-older-flow')&&!logs.includes('isolated-fixture-refresh-token')&&!logs.includes('/authorize?'));
  fs.writeFileSync(path.join(__dirname,'server-pkce-fixtures.json'),JSON.stringify({success:true,checks:checks.length,scope:'Real Supabase SSR/Auth SDK and Next request/response cookies; isolated fake token transport and profile/destination boundaries. No external network/account/Google consent/payment.',concurrency:'SDK retains one verifier per browser cookie. Overlapping flows fail closed; a fresh attempt is required.',results:checks},null,2)+'\n');
  console.log(JSON.stringify({success:true,checks:checks.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
