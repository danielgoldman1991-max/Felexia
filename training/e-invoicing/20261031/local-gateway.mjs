// Deliberately small Supabase HTTP test double. Auth is simulated; SQL and RLS are real.
// No .env loading, production secrets, external HTTP, arbitrary SQL endpoint or remote listener.
import { createServer } from "node:http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLocalDatabase, repositoryRoot } from "./local-bootstrap.mjs";

const HOST = "127.0.0.1", PORT = Number(process.argv.find(value => value.startsWith("--port="))?.slice(7) || "55441");
if (![55441, 55442].includes(PORT)) throw new Error("Only the named loopback fixture ports are permitted");
const operations = PORT === 55442, URL_ROOT = `http://${HOST}:${PORT}`, APP_URL = operations ? "http://localhost:3104" : "http://localhost:3102";
const APP_ORIGINS = new Set(["http://localhost:3102", "http://127.0.0.1:3102", "http://localhost:3103", "http://127.0.0.1:3103", "http://localhost:3104", "http://127.0.0.1:3104"]);
const packageRoot = process.argv.find(value => value.startsWith("--pglite-root="))?.slice(14);
if (!process.argv.includes("--local-only")) throw new Error("Explicit --local-only is required");
const {db, users, ids, engine, migrationSha256, operationsMigrationSha256} = await createLocalDatabase(packageRoot, { operations }).catch(error => {console.error(JSON.stringify({ready:false,message:error.message,code:error.code,detail:error.detail}));process.exit(1);});
const privateDirectory = resolve(repositoryRoot, "../backups");
const expectedManifest = operations ? "einvoice-operations-local-private.json" : "einvoice-local-preprod-private.json";
const manifestArgument = process.argv.find(value => value.startsWith("--manifest="))?.slice(11) || expectedManifest;
const privatePath = resolve(privateDirectory, manifestArgument);
if (privatePath !== join(privateDirectory, expectedManifest)) throw new Error("The selected port requires its own exact local manifest");
await mkdir(privateDirectory, {recursive:true});
let prior;
if(process.argv.includes("--reuse-local-credentials")){
  prior=JSON.parse(await readFile(privatePath,"utf8"));
  if(prior.localOnly!==true||prior.authSimulated!==true||prior.gatewayUrl!==URL_ROOT||!/^[-\w]{64}$/.test(prior.jwtSecret)||users.some(user=>!prior.users.some(old=>old.id===user.id&&old.email===user.email&&typeof old.password==="string")))throw Error("Only the matching local test manifest may be reused");
}
const jwtSecret = prior?.jwtSecret??randomBytes(48).toString("base64url");
const sessions = new Map();
for (const user of users) user.password = prior?.users.find(old=>old.id===user.id)?.password??`Local-only-${randomBytes(24).toString("base64url")}!9a`;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const mac = value => createHmac("sha256", jwtSecret).update(value).digest();
function sign(payload) {
  const unsigned = `${encode({alg:"HS256",typ:"JWT"})}.${encode(payload)}`;
  return `${unsigned}.${mac(unsigned).toString("base64url")}`;
}
const now = () => Math.floor(Date.now()/1000);
const anonKey = prior?.anonKey??sign({iss:`${URL_ROOT}/auth/v1`,role:"anon",iat:now(),exp:now()+86400});
const serviceRoleKey = prior?.serviceRoleKey??sign({iss:`${URL_ROOT}/auth/v1`,role:"service_role",iat:now(),exp:now()+86400});
function verify(token) {
  try {
    const pieces = token.split(".");
    if (pieces.length!==3) throw Error();
    const header=JSON.parse(Buffer.from(pieces[0],"base64url"));
    const payload=JSON.parse(Buffer.from(pieces[1],"base64url"));
    const signature=Buffer.from(pieces[2],"base64url"), expected=mac(`${pieces[0]}.${pieces[1]}`);
    if(header.alg!=="HS256" || signature.length!==expected.length || !timingSafeEqual(signature,expected) || payload.exp<=now() || payload.iss!==`${URL_ROOT}/auth/v1` || !["anon","authenticated","service_role"].includes(payload.role)) throw Error();
    if(payload.role==="authenticated" && (!users.some(user=>user.id===payload.sub) || !sessions.has(payload.session_id))) throw Error();
    return payload;
  } catch { throw Object.assign(new Error("Invalid or expired local test JWT"),{status:401,code:"bad_jwt"}); }
}
function publicUser(user) {
  return {id:user.id,aud:"authenticated",role:"authenticated",email:user.email,email_confirmed_at:"2026-10-31T00:00:00.000Z",confirmed_at:"2026-10-31T00:00:00.000Z",app_metadata:{provider:"email",providers:["email"]},user_metadata:{full_name:`Recette locale ${user.role}`},identities:[],created_at:"2026-10-31T00:00:00.000Z",updated_at:"2026-10-31T00:00:00.000Z",is_anonymous:false};
}
function issue(user, oldSession) {
  if(oldSession) sessions.delete(oldSession);
  const sessionId=randomUUID(), refreshToken=randomBytes(48).toString("base64url");
  sessions.set(sessionId,{userId:user.id,refreshToken,expiresAt:now()+86400});
  const payload={iss:`${URL_ROOT}/auth/v1`,sub:user.id,aud:"authenticated",role:"authenticated",email:user.email,iat:now(),exp:now()+3600,session_id:sessionId,aal:"aal1",amr:[{method:"password",timestamp:now()}],is_anonymous:false};
  return {access_token:sign(payload),token_type:"bearer",expires_in:3600,expires_at:payload.exp,refresh_token:refreshToken,user:publicUser(user)};
}
const manifest={localOnly:true,authSimulated:true,operations,createdAt:new Date().toISOString(),gatewayUrl:URL_ROOT,appUrl:APP_URL,engine,migrationSha256,operationsMigrationSha256,jwtSecret,anonKey,serviceRoleKey,users,ids,environment:{NEXT_PUBLIC_SUPABASE_URL:URL_ROOT,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anonKey,NEXT_PUBLIC_SUPABASE_ANON_KEY:anonKey,SUPABASE_SERVICE_ROLE_KEY:serviceRoleKey,NEXT_PUBLIC_APP_URL:APP_URL,FELEXIA_ERP_MODE:"light",FELEXIA_EINVOICING_ENABLED:"false",FELEXIA_EINVOICING_ORGANIZATION_IDS:ids.organizationId,RECOVERY_SIGNING_SECRET:prior?.environment.RECOVERY_SIGNING_SECRET??randomBytes(48).toString("base64url"),STRIPE_SECRET_KEY:"",STRIPE_WEBHOOK_SECRET:"",NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:"",CRON_SECRET:""}};
await writeFile(privatePath,JSON.stringify(manifest,null,2)+"\n",{mode:0o600});

const ident=value=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw Object.assign(new Error("Unsupported SQL identifier"),{status:400});return '"'+value+'"';};
const tableNames=new Set(["profiles","organizations","organization_members","roles","organization_subscriptions","organization_modules","modules_catalog","company_settings","customer_invoices","customer_invoice_lines","customer_credit_notes","customer_credit_note_lines","third_parties","units","tax_rates","products","accounting_entries","app_notifications","einvoice_settings","einvoice_documents","einvoice_versions","einvoice_artifacts","einvoice_source_index","einvoice_validations","einvoice_transmissions","einvoice_jobs","einvoice_events"]);
const schemaRows=(await db.query("select table_name,column_name from information_schema.columns where table_schema='public' order by ordinal_position")).rows;
const originalSubscriptions=(await db.query("select id,status,trial_start::text,trial_started_at::text,trial_end::text,trial_ends_at::text,current_period_end::text from organization_subscriptions where organization_id=$1",[ids.organizationId])).rows;
const columns=new Map();for(const row of schemaRows){if(!columns.has(row.table_name))columns.set(row.table_name,new Set());columns.get(row.table_name).add(row.column_name);}
// The selected FK name never comes from a request; only catalog metadata and known table names do.
const foreignKeys=(await db.query("select c.relname parent,f.relname child,a.attname parent_column,b.attname child_column from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_class f on f.oid=con.confrelid join pg_attribute a on a.attrelid=c.oid and a.attnum=con.conkey[1] join pg_attribute b on b.attrelid=f.oid and b.attnum=con.confkey[1] join pg_namespace n on n.oid=c.relnamespace where con.contype='f' and n.nspname='public' and array_length(con.conkey,1)=1")).rows;
function splitTop(value,separator=",") {let depth=0,start=0;const result=[];for(let index=0;index<value.length;index++){if(value[index]==="(")depth++;if(value[index]===")")depth--;if(value[index]===separator&&depth===0){result.push(value.slice(start,index).trim());start=index+1;}if(depth<0)throw Object.assign(Error("Invalid projection"),{status:400});}if(depth!==0)throw Object.assign(Error("Invalid projection"),{status:400});result.push(value.slice(start).trim());return result.filter(Boolean);}
function projection(table,selection,alias="t",depth=0) {
  if(depth>3)throw Object.assign(Error("Projection too deep"),{status:400});
  const fields=[];
  for(const item of splitTop(selection||"*")) {
    if(item==="*"){for(const column of columns.get(table)||[])fields.push(`'${column}',${alias}.${ident(column)}`);continue;}
    const relation=item.match(/^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)(?:![a-z_][a-z0-9_]*)?\((.*)\)$/s);
    if(relation){const [,label,target,nested]=relation;if(!tableNames.has(target)||!columns.has(target))throw Object.assign(Error("Relationship unavailable in local harness"),{status:400});const key=foreignKeys.find(fk=>fk.parent===table&&fk.child===target);const reverse=foreignKeys.find(fk=>fk.child===table&&fk.parent===target);const next=`r${depth}`;let expression;
      if(key)expression=`(select ${projection(target,nested,next,depth+1)} from public.${ident(target)} ${next} where ${next}.${ident(key.child_column)}=${alias}.${ident(key.parent_column)} limit 1)`;
      else if(reverse)expression=`(select coalesce(jsonb_agg(${projection(target,nested,next,depth+1)}),'[]'::jsonb) from public.${ident(target)} ${next} where ${next}.${ident(reverse.parent_column)}=${alias}.${ident(reverse.child_column)})`;
      else throw Object.assign(Error("Relationship unavailable in local harness"),{status:400});
      fields.push(`'${label||target}',${expression}`);continue;
    }
    const scalar=item.match(/^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)$/);
    if(!scalar||!columns.get(table)?.has(scalar[2]))throw Object.assign(Error(`Column unavailable in local harness: ${item}`),{status:400,code:"42703"});
    fields.push(`'${scalar[1]||scalar[2]}',${alias}.${ident(scalar[2])}`);
  }
  return `jsonb_build_object(${fields.join(",")})`;
}
const bind=(params,value)=>{params.push(value);return `$${params.length}`;};
function filter(table,column,value,params){if(!columns.get(table)?.has(column))throw Object.assign(Error("Unsupported filter column"),{status:400});const target=`t.${ident(column)}`;const match=value.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s);if(!match)throw Object.assign(Error("Unsupported filter"),{status:400});const [,operator,raw]=match;
  if(operator==="is"){if(!["null","true","false"].includes(raw))throw Object.assign(Error("Unsupported is filter"),{status:400});return `${target} is ${raw}`;}
  if(operator==="in"){if(!raw.startsWith("(")||!raw.endsWith(")"))throw Object.assign(Error("Invalid in filter"),{status:400});const values=splitTop(raw.slice(1,-1));if(!values.length)return "false";return `${target} in (${values.map(value=>bind(params,value.replace(/^\"|\"$/g,""))).join(",")})`;}
  return `${target} ${{eq:"=",neq:"<>",gt:">",gte:">=",lt:"<",lte:"<=",like:"like",ilike:"ilike"}[operator]} ${bind(params,operator.includes("like")?raw.replaceAll("*","%"):raw)}`;
}
let tail=Promise.resolve();
function inRole(claims,run){const next=tail.then(async()=>{await db.exec("begin");try{await db.exec(`set local role ${claims.role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[claims.sub||"",claims.role]);const result=await run();await db.exec("commit");return result;}catch(error){await db.exec("rollback");throw error;}});tail=next.catch(()=>{});return next;}
async function restRead(url,claims,req){const table=url.pathname.slice("/rest/v1/".length);if(!tableNames.has(table)||!columns.has(table))throw Object.assign(Error("Table unavailable in local harness"),{status:404,code:"42P01"});const params=[],where=[];
  for(const [key,value]of url.searchParams){if(["select","order","limit","offset"].includes(key))continue;if(key==="or"){const expression=value.replace(/^\(|\)$/g,"");where.push(`(${splitTop(expression).map(part=>{const point=part.indexOf(".");return filter(table,part.slice(0,point),part.slice(point+1),params);}).join(" or ")})`);}else where.push(filter(table,key,value,params));}
  const conditions=where.length?`where ${where.join(" and ")}`:"";
  const ordered=splitTop(url.searchParams.get("order")||"").map(value=>{const [column,direction="asc",nulls]=value.split(".");if(!columns.get(table).has(column)||!["asc","desc"].includes(direction)||nulls&&!['nullsfirst','nullslast'].includes(nulls))throw Object.assign(Error("Unsupported order"),{status:400});return `t.${ident(column)} ${direction}${nulls?` ${nulls==='nullsfirst'?'nulls first':'nulls last'}`:""}`;});
  let offset=Number(url.searchParams.get("offset")||0),limit=Number(url.searchParams.get("limit")||1000);const range=req.headers.range?.match(/^(\d+)-(\d+)$/);if(range){offset=Number(range[1]);limit=Number(range[2])-offset+1;}if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<0||limit>1000)throw Object.assign(Error("Invalid pagination"),{status:400});
  return inRole(claims,async()=>{const total=Number((await db.query(`select count(*) count from public.${ident(table)} t ${conditions}`,params)).rows[0].count);const data=(await db.query(`select ${projection(table,url.searchParams.get("select"))} result from public.${ident(table)} t ${conditions} ${ordered.length?`order by ${ordered.join(",")}`:""} limit ${limit} offset ${offset}`,params)).rows.map(row=>row.result);return{data,total,offset};});
}
async function rpc(url,claims,body){const name=url.pathname.slice("/rest/v1/rpc/".length);if(!/^einvoice_[a-z_]+$/.test(name)&&name!=="get_commercial_document_usage")throw Object.assign(Error("RPC unavailable in local harness"),{status:404});if(!body||Array.isArray(body)||typeof body!=="object")throw Object.assign(Error("RPC requires an argument object"),{status:400});
  return inRole(claims,async()=>{const candidates=(await db.query("select p.oid,p.proargnames,p.pronargs,p.pronargdefaults,p.proretset,pg_get_function_result(p.oid) result_type,array(select format_type(x,null) from unnest(p.proargtypes) x) argtypes from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",[name])).rows;const keys=Object.keys(body);const candidate=candidates.find(item=>keys.every(key=>item.proargnames?.includes(key))&&item.proargnames?.slice(0,item.pronargs-item.pronargdefaults).every(key=>keys.includes(key)));if(!candidate)throw Object.assign(Error("RPC signature not found"),{status:404,code:"PGRST202"});
    const params=[];const args=candidate.proargnames.slice(0,candidate.pronargs).flatMap((key,index)=>{if(!keys.includes(key))return[];const value=body[key];return [`${ident(key)}=>${bind(params,value!==null&&["json","jsonb"].includes(candidate.argtypes[index])?JSON.stringify(value):value)}::${candidate.argtypes[index]}`];});const response=await db.query(`select public.${ident(name)}(${args.join(",")}) result`,params);return candidate.proretset?response.rows.map(row=>row.result):response.rows[0]?.result??null;});
}
async function insertNotification(claims,body){
  if(!body||Array.isArray(body)||typeof body!=="object"||!Object.keys(body).length||Object.keys(body).some(key=>!columns.get("app_notifications").has(key)))throw Object.assign(Error("Invalid notification fixture insert"),{status:400});
  return inRole(claims,async()=>{const params=[],keys=Object.keys(body);await db.query(`insert into public.app_notifications(${keys.map(ident).join(",")})values(${keys.map(key=>bind(params,key==="metadata"?JSON.stringify(body[key]):body[key])).join(",")})`,params);return null;});
}
// Protocol hooks exist ONLY in this loopback test server. They expose named fixture operations, never client SQL.
async function localFixtureHook(path,claims,body){
  if(claims.role!=="service_role"||body.organizationId!==ids.organizationId)throw Object.assign(Error("Local service/fixture scope required"),{status:403});
  return inRole({role:"service_role"},async()=>{
    if(path==="advance-retries"){await db.exec("set local role postgres");const changed=await db.query("update einvoice_jobs set available_at=now()-interval'1 second' where organization_id=$1 and status='retry_wait' returning id",[ids.organizationId]);return{advanced:changed.rows.length,fixtureOnly:true};}
    if(path==="subscription-state"&&["expired","restore"].includes(body.state)){
      await db.exec("set local role postgres");
      if(body.state==="expired")await db.query("update organization_subscriptions set trial_end=now()-interval'1 day',trial_ends_at=now()-interval'1 day',current_period_end=now()-interval'1 day' where organization_id=$1",[ids.organizationId]);
      else for(const row of originalSubscriptions)await db.query("update organization_subscriptions set status=$2,trial_start=$3::timestamptz,trial_started_at=$4::timestamptz,trial_end=$5::timestamptz,trial_ends_at=$6::timestamptz,current_period_end=$7::timestamptz where organization_id=$8 and id=$1",[row.id,row.status,row.trial_start,row.trial_started_at,row.trial_end,row.trial_ends_at,row.current_period_end,ids.organizationId]);
      return{state:body.state,fixtureOnly:true};
    }
    throw Object.assign(Error("Unknown named fixture operation"),{status:400});
  });
}
async function readBody(req){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>12*1024*1024)throw Object.assign(Error("Payload too large"),{status:413});parts.push(part);}if(!size)return{};try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}catch{throw Object.assign(Error("Invalid JSON"),{status:400});}}
function send(res,status,data,extra={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});res.end(status===204?undefined:JSON.stringify(data,(_key,value)=>value instanceof Uint8Array?'\\x'+Buffer.from(value).toString('hex'):value));}
const server=createServer(async(req,res)=>{
  try{
    const remote=req.socket.remoteAddress;if(!["127.0.0.1","::ffff:127.0.0.1","::1"].includes(remote))throw Object.assign(Error("Loopback only"),{status:403});
    const origin=req.headers.origin;if(origin&&!APP_ORIGINS.has(origin))throw Object.assign(Error("Local origin refused"),{status:403});
    if(origin){res.setHeader("access-control-allow-origin",origin);res.setHeader("vary","Origin");res.setHeader("access-control-allow-credentials","true");res.setHeader("access-control-expose-headers","content-range,range-unit");}
    if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-methods":"GET,HEAD,POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,prefer,range,x-client-info,x-supabase-api-version"});res.end();return;}
    const url=new URL(req.url,URL_ROOT);
    if(url.pathname==="/health"&&req.method==="GET"){send(res,200,{localOnly:true,authSimulated:true,database:"real PostgreSQL/PGlite",productionAccess:false});return;}
    if(url.pathname==="/auth/v1/.well-known/jwks.json"&&req.method==="GET"){send(res,200,{keys:[]});return;}
    if(url.pathname==="/auth/v1/settings"&&req.method==="GET"){send(res,200,{external:{email:true},disable_signup:true,mailer_autoconfirm:true,phone_autoconfirm:false});return;}
    if(url.pathname==="/auth/v1/token"&&req.method==="POST"){
      verify(String(req.headers.apikey||""));const body=await readBody(req);let user,oldSession;
      if(url.searchParams.get("grant_type")==="password"){user=users.find(candidate=>candidate.email===body.email&&candidate.password===body.password);}
      else if(url.searchParams.get("grant_type")==="refresh_token"){const session=[...sessions].find(([,value])=>value.refreshToken===body.refresh_token&&value.expiresAt>now());if(session){oldSession=session[0];user=users.find(candidate=>candidate.id===session[1].userId);}}
      if(!user){send(res,400,{error:"invalid_grant",error_code:"invalid_credentials",msg:"Invalid local test credentials"});return;}send(res,200,issue(user,oldSession));return;
    }
    const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"")||String(req.headers.apikey||"");const claims=verify(token);
    if(url.pathname==="/auth/v1/user"&&req.method==="GET"){const user=users.find(candidate=>candidate.id===claims.sub);if(!user)throw Object.assign(Error("Auth session missing"),{status:401,code:"session_not_found"});send(res,200,publicUser(user));return;}
    if(url.pathname==="/auth/v1/logout"&&req.method==="POST"){if(claims.session_id)sessions.delete(claims.session_id);send(res,204);return;}
    if(url.pathname.startsWith("/__local-test__/")&&req.method==="POST"){send(res,200,await localFixtureHook(url.pathname.slice("/__local-test__/".length),claims,await readBody(req)));return;}
    if(url.pathname.startsWith("/rest/v1/rpc/")&&req.method==="POST"){send(res,200,await rpc(url,claims,await readBody(req)));return;}
    if(url.pathname==="/rest/v1/app_notifications"&&req.method==="POST"){send(res,201,await insertNotification(claims,await readBody(req)));return;}
    if(url.pathname.startsWith("/rest/v1/")&&["GET","HEAD"].includes(req.method)){const {data,total,offset}=await restRead(url,claims,req);const headers={"content-range":data.length?`${offset}-${offset+data.length-1}/${total}`:`*/${total}`,"range-unit":"items"};if(req.headers.accept?.includes("application/vnd.pgrst.object+json")){if(data.length!==1){send(res,406,{code:"PGRST116",details:`The result contains ${data.length} rows`,message:"Cannot coerce the result to a single JSON object"},headers);return;}send(res,200,data[0],headers);}else if(req.method==="HEAD"){res.writeHead(200,headers);res.end();}else send(res,200,data,headers);return;}
    throw Object.assign(Error("Endpoint/method unavailable in local harness"),{status:405});
  }catch(error){const status=error.status||(error.code==="42501"?403:["23514","22023","40001","23505"].includes(error.code)?409:500);send(res,status,{code:error.code||"LOCAL_HARNESS",message:error.message,details:error.detail||null,hint:null});}
});
server.listen(PORT,HOST,()=>console.log(JSON.stringify({ready:true,gatewayUrl:URL_ROOT,appUrl:manifest.appUrl,privatePath,authSimulated:true,productionAccess:false})));
for(const event of ["SIGINT","SIGTERM"])process.on(event,()=>server.close(async()=>{await tail;await db.close();process.exit(0);}));
