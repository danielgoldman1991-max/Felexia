// Disposable local PostgreSQL only; no project credentials are read.
import {readFile,writeFile,mkdtemp,rm,rmdir} from "node:fs/promises";
import {fileURLToPath,pathToFileURL} from "node:url";
import {join} from "node:path";
import {tmpdir} from "node:os";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const baseline=(await readFile(join(root,"training/essential-fixes/20261031/verify-subscription-access.mjs"),"utf8")).replaceAll("\r\n","\n");
const marker="\ntry {\n  await bootstrap();";
if(!baseline.includes(marker))throw Error("Review changed bootstrap");
let source=baseline.slice(0,baseline.indexOf(marker));
source=source.replace("new URL(`../../../supabase/migrations/${file}`, import.meta.url)","new URL(file,"+JSON.stringify(pathToFileURL(join(root,"supabase/migrations/")).href)+")");
source+="\nconst fixturePath="+JSON.stringify(join(root,"training/essential-fixes/20261031/native-finance-fixture.json"))+";\n";
source+=String.raw`
try {
  if((await one("select to_regclass('public.customer_invoices') present")).present) throw Error("Bootstrap requires a fresh, empty dedicated QA database; existing fixtures are never overwritten");
  await bootstrap();
  await db.exec("alter table accounting_accounts add column if not exists code text,add column if not exists name text;alter table accounting_entries add column if not exists total_debit numeric,add column if not exists total_credit numeric,add column if not exists posted_at timestamptz,add column if not exists posted_by uuid,add column if not exists created_by uuid;alter table accounting_entry_lines add column if not exists account_id uuid references accounting_accounts(id),add column if not exists account_code text,add column if not exists account_label text,add column if not exists line_number integer,add column if not exists debit numeric,add column if not exists credit numeric,add column if not exists label text;");
  await db.exec("do $$ begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
  await db.exec(await sql("041_create_organization_with_owner_rpc.sql"));
  await db.exec(await sql("024_customer_credit_notes_return_source.sql"));
  for(const migration of ["097_document_numbering_controls.sql","098_essential_finance_integrity.sql","099_essential_subscription_access.sql","100_essential_credit_note_corrections.sql","101_essential_supplier_credit_notes.sql"])await db.exec(await sql(migration));
  for(const [user,name] of [[ids.admin,"admin"],[ids.operator,"operator"],[ids.viewer,"viewer"]]){
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,name+"@example.test"]);
    await db.query("insert into profiles(id,email) values($1,$2)",[user,name+"@example.test"]);
  }
  await as(ids.admin);
  const org=(await one("select create_organization_with_owner('Essential isolated concurrency','essential-concurrency-local','Admin') id")).id;
  await one("select ensure_essential_trial($1) as created",[org]);
  for(const [user,name] of [[ids.operator,"operator"],[ids.viewer,"viewer"]]){
    const role=await one("insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id",[org,name]);
    await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')",[org,user,role.id]);
  }
  const customer=await one("insert into third_parties(organization_id,primary_type,types,name) values($1,'customer',array['customer'],'Synthetic local customer') returning id",[org]);
  const supplier=await one("insert into third_parties(organization_id,primary_type,types,name) values($1,'supplier',array['supplier'],'Synthetic local supplier') returning id",[org]);
  const bank=await one("insert into treasury_accounts(organization_id,name,currency,current_balance) values($1,'MAD synthetic','MAD',0) returning id",[org]);
  const journal=await one("insert into accounting_journals(organization_id,code,name) values($1,'BQ','Bank journal') returning id",[org]);
  const accountA=await one("insert into accounting_accounts(organization_id,code,name) values($1,'5141','Bank') returning id",[org]);
  const accountB=await one("insert into accounting_accounts(organization_id,code,name) values($1,'3421','Customer') returning id",[org]);
  const fixture={org,admin:ids.admin,operator:ids.operator,viewer:ids.viewer,customer:customer.id,supplier:supplier.id,bank:bank.id,journal:journal.id,accountA:accountA.id,accountB:accountB.id,period:(await one("select current_date::text date")).date};
  await writeFile(fixturePath,JSON.stringify(fixture,null,2));
  console.log(JSON.stringify({prepared:true,threeRoles:true,migrations:[97,98,99,100,101],database:"dedicated local QA"}));
}finally{await db.close();}
`;
const folder=await mkdtemp(join(tmpdir(),"essential-native-bootstrap-"));const runtime=join(folder,"prepare.mjs");
try{await writeFile(runtime,source);await import(pathToFileURL(runtime).href);}finally{await rm(runtime,{force:true});await rmdir(folder);}
