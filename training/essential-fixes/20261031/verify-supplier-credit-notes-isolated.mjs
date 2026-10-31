// Reuses the exact native workflow in disposable PostgreSQL/WASM; no .env or network.
import {readFile,writeFile,mkdtemp,rm,rmdir} from "node:fs/promises";
import {fileURLToPath,pathToFileURL} from "node:url";
import {join} from "node:path";
import {tmpdir} from "node:os";
if(process.argv.some(arg=>arg.startsWith("--postgres-url=")))throw Error("This runner creates a disposable in-memory database only");
const root=fileURLToPath(new URL("../../../",import.meta.url));
const baseline=(await readFile(join(root,"training/essential-fixes/20261031/verify-subscription-access.mjs"),"utf8")).replaceAll("\r\n","\n");
const marker="\ntry {\n  await bootstrap();";
if(!baseline.includes(marker))throw Error("Review changed bootstrap");
let source=baseline.slice(0,baseline.indexOf(marker));
source=source.replace("new URL(`../../../supabase/migrations/${file}`, import.meta.url)","new URL(file,"+JSON.stringify(pathToFileURL(join(root,"supabase/migrations/")).href)+")");
source=source.replace('await db.exec(`set role ${role}`);','if(user)await db.exec(`set role ${role}`);');
source+=String.raw`
await bootstrap();
await db.exec("alter table accounting_accounts add column code text,add column name text;alter table accounting_entries add column total_debit numeric,add column total_credit numeric,add column posted_at timestamptz,add column posted_by uuid,add column created_by uuid;alter table accounting_entry_lines add column account_id uuid references accounting_accounts(id),add column account_code text,add column account_label text,add column line_number integer,add column debit numeric,add column credit numeric,add column label text;");
await db.exec("do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
for(const migration of ["024_customer_credit_notes_return_source.sql","041_create_organization_with_owner_rpc.sql","097_document_numbering_controls.sql","098_essential_finance_integrity.sql","099_essential_subscription_access.sql","100_essential_credit_note_corrections.sql","101_essential_supplier_credit_notes.sql"])await db.exec(await sql(migration));
await db.exec(await sql("101_essential_supplier_credit_notes.sql"));
for(const [user,name] of [[ids.admin,"admin"],[ids.operator,"operator"],[ids.viewer,"viewer"]]){
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,name+"-supplier-credit@example.test"]);
 await db.query("insert into profiles(id,email) values($1,$2)",[user,name+"-supplier-credit@example.test"]);
}
await as(ids.admin);
const org=(await one("select create_organization_with_owner('Supplier credit QA','supplier-credit-local','Admin') id")).id;
await one("select ensure_essential_trial($1)",[org]);
for(const [user,name] of [[ids.operator,"operator"],[ids.viewer,"viewer"]]){
 const role=await one("insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id",[org,name]);
 await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[org,user,role.id]);
}
const supplier=await one("insert into third_parties(organization_id,primary_type,types,name) values($1,'supplier',array['supplier'],'Synthetic supplier') returning id",[org]);
const bank=await one("insert into treasury_accounts(organization_id,name,currency,current_balance) values($1,'Synthetic MAD','MAD',0) returning id",[org]);
const accountA=await one("insert into accounting_accounts(organization_id,code,name) values($1,'5141','Bank') returning id",[org]);
const fixture={org,admin:ids.admin,operator:ids.operator,viewer:ids.viewer,supplier:supplier.id,bank:bank.id,accountA:accountA.id,period:(await one("select current_date::text date")).date};
`;
const native=(await readFile(join(root,"training/essential-fixes/20261031/verify-supplier-credit-notes.mjs"),"utf8")).replaceAll("\r\n","\n");
let workflow=native.slice(native.indexOf("const line="));
workflow=workflow.replace("await db.connect();","").replaceAll(".rowCount",".rows.length").replace('engine:"Native PostgreSQL"',"engine").replace('new URL("supplier-credit-native.json",import.meta.url)',JSON.stringify(fileURLToPath(new URL(process.argv.includes("--relaxed-v3")?"supplier-credit-relaxed.json":"supplier-credit-strict.json",import.meta.url)))).replace("await db.end();","await db.close();");
source+=workflow;
source=source.replaceAll('db.query("set constraints all immediate;set constraints all deferred")','db.exec("set constraints all immediate;set constraints all deferred")').replaceAll('db.query("rollback;reset role")','db.exec("rollback;reset role")');
const folder=await mkdtemp(join(tmpdir(),"essential-supplier-credit-"));const runtime=join(folder,"verify.mjs");
try{await writeFile(runtime,source);await import(pathToFileURL(runtime).href);}finally{await rm(runtime,{force:true});await rmdir(folder);}
