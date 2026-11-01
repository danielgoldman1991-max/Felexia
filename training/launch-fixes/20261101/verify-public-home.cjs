const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const {NextRequest}=require('next/server');
const root=path.resolve(__dirname,'../../..');
const source=path.join(root,'src/lib/supabase/middleware.ts');
const output=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let touched=0;
const state={exports:{}};
vm.runInNewContext(output,{module:state,exports:state.exports,require(name){
 if(name==='next/server')return require(name);
 if(name==='@supabase/ssr')return{createServerClient(){touched++;throw new Error('Auth provider unavailable');}};
 if(name==='@/lib/env')return{getEnv(){touched++;throw new Error('Public home must not require Auth configuration');}};
 if(name.startsWith('@/'))return{};
 throw new Error('Unexpected dependency '+name);
}});
async function run(){
 const checks=[];
 for(const headers of [{},{cookie:'sb-fixture-auth-token=expired-synthetic-session'}]){
  touched=0;
  const response=await state.exports.updateSession(new NextRequest('https://www.felexia.pro/',{headers}));
  assert.equal(response.status,200);assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(touched,0);
  checks.push(headers.cookie?'Expired session does not initialize Auth or delay public home':'Anonymous public home does not initialize Auth or depend on its configuration');
 }
 fs.writeFileSync(path.join(__dirname,'public-home-tests.json'),JSON.stringify({passed:true,assertions:checks.length,checks,scope:'Actual middleware and Next response; Auth constructor and environment deliberately fail if reached. No network.'},null,2));
 console.log(JSON.stringify({passed:true,assertions:checks.length}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
