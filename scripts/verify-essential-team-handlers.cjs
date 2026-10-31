/* eslint-disable @typescript-eslint/no-require-imports -- Read-only fixture harness for real route handlers. */
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {createActionRunner}=require('./essential-action-runner.cjs');
const org='fixture-company';let checks=0;const results=[];
function check(name,condition){assert.ok(condition,name);checks++;results.push(name);}
function fixture(options={}){
  const roles=[{id:'role-admin',organization_id:org,name:'admin'},{id:'role-operator',organization_id:org,name:'operator'},{id:'role-viewer',organization_id:org,name:'viewer'}];
  const members=['admin','operator','viewer'].map(role=>({id:'member-'+role,user_id:role,organization_id:org,role_id:'role-'+role,status:'active',role:{name:role}}));
  const writes=[];
  const db={auth:{getUser:async()=>({data:{user:options.actor===null?null:{id:options.actor || 'admin'}}})},from(table){
    const filters=[];let patch=null;let single=false;
    const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},in(key,values){filters.push([key,new Set(values)]);return query;},limit(){return query;},single(){single=true;return query;},maybeSingle(){single=true;return query;},update(value){patch=value;return query;},then(resolve,reject){
      const source=table==='roles'?roles:members;const matching=source.filter(row=>filters.every(([key,value])=>value instanceof Set?value.has(row[key]):row[key]===value));
      let data=matching;let error=null;
      if(patch){writes.push({table,filters,patch});if(options.writeError)error={code:options.writeError,message:'Fixture DB refusal'};else if(options.noUpdatedRow)data=[];else for(const row of matching)Object.assign(row,patch);}
      else if(options.readError)error={code:'XX000',message:'Fixture read unavailable'};
      return Promise.resolve({data:error?null:single?(data[0] || null):data,error,count:error?null:data.length}).then(resolve,reject);
    }};return query;
  }};
  return {db,writes,members};
}
async function invoke(kind,method,body,options={}){
  const f=fixture(options);const runner=createActionRunner(()=>f.db,[],{modules:{'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}}}});
  const route=runner.load('src/app/api/organization-members/[id]/'+(kind==='role'?'role/':'')+'route.ts');
  const response=await route[method](new Request('https://fixture.test/member',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({id:options.target || 'member-viewer'})});
  return {response,json:await response.json(),...f};
}
async function main(){
  for(const [kind,method,body] of [['status','PATCH',{status:'disabled'}],['status','DELETE',null],['role','PATCH',{roleId:'role-operator'}]]){
    for(const [options,status,label] of [[{},200,'confirmed update'],[{writeError:'42501'},403,'RLS refusal'],[{writeError:'23514'},409,'business refusal'],[{noUpdatedRow:true},409,'no updated row'],[{readError:true},503,'read unavailable']]){
      const output=await invoke(kind,method,body,options);check(kind+' '+method+' '+label+' HTTP',output.response.status===status);check(kind+' '+method+' '+label+' success truth',status===200?output.json.success===true:output.json.success!==true);
      for(const write of output.writes)check(kind+' '+method+' update explicitly scoped by tenant',write.filters.some(([key,value])=>key==='organization_id' && value===org));
    }
    for(const actor of ['operator','viewer']){const output=await invoke(kind,method,body,{actor});check(actor+' cannot administer '+kind+' '+method,output.response.status===403 && output.writes.length===0);}
    const unauth=await invoke(kind,method,body,{actor:null});check('unauthenticated cannot administer '+kind+' '+method,unauth.response.status===401 && unauth.writes.length===0);
  }
  for(const [kind,method,body] of [['status','PATCH',{status:'disabled'}],['status','DELETE',null],['role','PATCH',{roleId:'role-viewer'}]]){
    const output=await invoke(kind,method,body,{target:'member-admin'});check('sole admin cannot remove own access '+kind+' '+method,output.response.status===403 && output.writes.length===0);
  }
  let smtpCalls=0;let reservations=0;const f=fixture();f.db.rpc=async name=>{assert.equal(name,'reserve_organization_invitation');reservations++;return {error:{code:'23514',message:'INVITATION_USER_LIMIT'}};};
  const quota=createActionRunner(()=>f.db,[],{modules:{'@/lib/auth':{getActiveWorkspace:async()=>({organization:{id:org},userId:'admin',role:'admin',subscription:{status:'trialing'}})},'@/lib/supabase/service':{createClient:()=>({auth:{admin:{inviteUserByEmail(){smtpCalls++;throw Error('SMTP forbidden in fixture');}}}})}}});
  let quotaCode;try{await quota.load('src/lib/auth/invite-user.ts').inviteOrganizationUser({email:'quota@example.test',roleId:'role-viewer',fullName:'Fixture quota'});}catch(error){quotaCode=error.code;}
  check('real quota refusal maps to USER_LIMIT before SMTP',quotaCode==='USER_LIMIT' && reservations===1 && smtpCalls===0);
  const report={date:new Date().toISOString(),passed:true,checks,results,networkRequests:0,databaseMutations:0,smtpCalls,scope:'Real membership handlers and invite source, deterministic failure fixtures'};
  const output=path.join(__dirname,'../training/essential-fixes/20261031/team-handlers.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks,networkRequests:0,databaseMutations:0,smtpCalls}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
