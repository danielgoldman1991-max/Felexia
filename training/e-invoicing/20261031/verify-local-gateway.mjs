// Local HTTP probes: simulated Auth transport, real SQL transactions/RLS/RPC.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { repositoryRoot } from "./local-bootstrap.mjs";
import { resolve } from "node:path";

const manifest=JSON.parse(await readFile(resolve(repositoryRoot,"../backups/einvoice-local-preprod-private.json"),"utf8"));
assert.equal(manifest.localOnly,true);assert.equal(manifest.authSimulated,true);assert.equal(manifest.gatewayUrl,"http://127.0.0.1:55441");
const results=[];let requests=0;
const check=(actual,expected,name)=>{assert.deepEqual(actual,expected,name);results.push(name);};
const localFetch=(url,options)=>{assert.equal(new URL(typeof url==="string"?url:url.url).origin,manifest.gatewayUrl,"All SDK traffic remains loopback");requests++;return fetch(url,options);};
const sdk=(key=manifest.anonKey)=>createClient(manifest.gatewayUrl,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localFetch}});
const sessions={};
try{
  const health=await(await localFetch(`${manifest.gatewayUrl}/health`)).json();check(health.productionAccess,false,"Gateway identifies production access as disabled");
  for(const identity of manifest.users){const client=sdk();const login=await client.auth.signInWithPassword({email:identity.email,password:identity.password});assert.ifError(login.error);check(login.data.user.id,identity.id,`${identity.role} password transport returns the local identity`);check((await client.auth.getClaims()).data.claims.sub,identity.id,`${identity.role} getClaims validates through the local Auth user endpoint`);check((await client.auth.getUser()).data.user.id,identity.id,`${identity.role} Auth user is authenticated`);sessions[identity.email.split("@")[0]]=client;}
  const {admin,operator,viewer,outsider}=sessions;
  for(const [role,client]of Object.entries({admin,operator,viewer})){
    const identity=manifest.users.find(user=>user.email.startsWith(`${role}@`));
    const membership=await client.from("organization_members").select("organization:organizations(id,name,slug),role:roles(name)").eq("user_id",identity.id).eq("status","active").limit(1).maybeSingle();assert.ifError(membership.error);check(membership.data.organization.id,manifest.ids.organizationId,`${role} embedded organization uses the real membership RLS`);check(membership.data.role.name,role,`${role} embedded role uses the real role relation`);
    const capture=await client.rpc("einvoice_capture_source",{p_source_kind:"invoice",p_source_id:manifest.ids.invoiceId});assert.ifError(capture.error);check(capture.data.facts.header.total_ttc,"388.00",`${role} actual capture preserves exact multirate/discount source totals`);check(capture.data.facts.lines.length,3,`${role} sees all three exact source lines`);
    const foreign=await client.from("customer_invoices").select("id").eq("organization_id",manifest.ids.foreignOrganizationId);assert.ifError(foreign.error);check(foreign.data.length,0,`${role} real financial RLS hides the other tenant`);
    const forbidden=await client.rpc("einvoice_save_preparation",{p_actor:manifest.users[0].id,p_source_kind:"invoice",p_source_id:manifest.ids.invoiceId,p_source_fingerprint:"0".repeat(64),p_snapshot:{},p_canonical_snapshot:"{}",p_validation:{},p_artifacts:[],p_profile_version:"test",p_expected_version:null,p_idempotency_key:"30000000-0000-4000-8000-000000000001"});check(forbidden.error?.code,"42501",`${role} cannot forge trusted preparation artifacts through public RPC`);
  }
  const draft=await operator.rpc("einvoice_capture_source",{p_source_kind:"invoice",p_source_id:manifest.ids.draftInvoiceId});assert.ifError(draft.error);check(draft.data.eligible,false,"Real SQL capture marks a draft source as ineligible");
  const credit=await operator.rpc("einvoice_capture_source",{p_source_kind:"credit_note",p_source_id:manifest.ids.creditNoteId});assert.ifError(credit.error);check(credit.data.facts.header.total_ttc,"54.00","Actual credit source retains exact totals and source invoice reference");check(typeof credit.data.facts.header.original_invoice_number,"string","Credit source contains original invoice reference");
  const denied=await viewer.rpc("einvoice_update_settings",{p_organization_id:manifest.ids.organizationId,p_enabled:true,p_mode:"disabled"});check(denied.error?.code,"42501","Viewer configuration mutation reaches and is refused by the actual SQL function");
  const alien=await outsider.rpc("einvoice_capture_source",{p_source_kind:"invoice",p_source_id:manifest.ids.invoiceId});check(alien.error?.code,"42501","An authenticated other-tenant account cannot capture the local target source");
  const sources=await admin.from("einvoice_source_index").select("*").eq("organization_id",manifest.ids.organizationId).order("id").range(0,19);assert.ifError(sources.error);check(sources.data.length,3,"Real security-invoker source index exposes invoice, draft and credit");
  const usage=await admin.rpc("get_commercial_document_usage",{p_organization_id:manifest.ids.organizationId});assert.ifError(usage.error);check(Number(usage.data),3,"Commercial quota is calculated by the actual SQL function");
  const lease=await sdk(manifest.serviceRoleKey).rpc("einvoice_claim_jobs",{p_worker:"local-http-probe",p_limit:1,p_organization_id:manifest.ids.organizationId});assert.ifError(lease.error);check(lease.data,[],"Local service JWT invokes the real typed worker RPC without inventing a job");
  const due=await sdk(manifest.serviceRoleKey).rpc("einvoice_due_organizations",{p_organization_ids:[manifest.ids.organizationId],p_limit:10});assert.ifError(due.error);check(due.data,[],"Cron organization discovery binds a real uuid array and returns no fictitious due job");
  const deniedDue=await admin.rpc("einvoice_due_organizations",{p_organization_ids:[manifest.ids.organizationId],p_limit:10});check(deniedDue.error?.code,"42501","A public user cannot invoke service-only due-organization discovery");
  const unrelated=await admin.rpc("save_customer_invoice_atomic",{});check(unrelated.status,404,"HTTP harness exposes no unrelated arbitrary RPC");
  const injection=await admin.from("third_parties").select("id").eq("name","' OR true --");assert.ifError(injection.error);check(injection.data,[],"REST filter values remain SQL bound parameters");
  const rawWrite=await localFetch(`${manifest.gatewayUrl}/rest/v1/customer_invoices`,{method:"POST",headers:{authorization:`Bearer ${(await admin.auth.getSession()).data.session.access_token}`,"content-type":"application/json"},body:"{}"});check(rawWrite.status,405,"Harness supplies no raw financial table mutation endpoint");
  const anon=await sdk().rpc("einvoice_capture_source",{p_source_kind:"invoice",p_source_id:manifest.ids.invoiceId});check(anon.error?.code,"42501","Anonymous local JWT cannot invoke source capture");
  const bad=await localFetch(`${manifest.gatewayUrl}/auth/v1/user`,{headers:{authorization:`Bearer ${manifest.anonKey.slice(0,-4)}bad!`}});check(bad.status,401,"Forged HS256 signatures are refused");
  const wrong=sdk();check((await wrong.auth.signInWithPassword({email:manifest.users[0].email,password:"incorrect-fixture"})).error?.status,400,"Wrong fixture password is refused");
  const refresh=await viewer.auth.refreshSession();assert.ifError(refresh.error);check(refresh.data.user.id,manifest.users.find(user=>user.role==="viewer").id,"Local refresh rotates session without changing SQL identity");
  const old=(await operator.auth.getSession()).data.session.access_token;assert.ifError((await operator.auth.signOut({scope:"local"})).error);check((await localFetch(`${manifest.gatewayUrl}/auth/v1/user`,{headers:{authorization:`Bearer ${old}`}})).status,401,"Local signout revokes the simulated session");
  check((await localFetch(`${manifest.gatewayUrl}/health`,{headers:{origin:"https://untrusted.example.test"}})).status,403,"Cross-origin browser requests are refused");
  const report={passed:true,date:new Date().toISOString(),nodeVersion:process.version,migrationSha256:manifest.migrationSha256,checks:results.length,requests,results,scope:{auth:"Explicit local HS256 test double; not a production Supabase Auth test",database:"Actual migrations and SQL/RLS/RPC on isolated in-memory PostgreSQL/PGlite",productionRead:false,productionWrite:false,externalRequests:0}};
  await writeFile(new URL("local-gateway-probes.json",import.meta.url),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({passed:true,checks:results.length,requests}));
}catch(error){console.error(JSON.stringify({passed:false,message:error.message,checks:results.length,results}));process.exitCode=1;}
