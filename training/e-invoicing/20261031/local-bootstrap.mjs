// Local test infrastructure only. It never reads project .env or opens a remote database.
import { readFile, writeFile, mkdtemp, rm, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export async function createLocalDatabase(packageRoot, { operations = false } = {}) {
  if (!packageRoot || process.argv.some(value => /--postgres-url|--pg-root|--relaxed/.test(value))) {
    throw new Error("An explicit isolated PGlite package directory is required; remote/native database arguments are forbidden");
  }
  const baseline = (await readFile(join(repositoryRoot, "training/essential-fixes/20261031/verify-subscription-access.mjs"), "utf8")).replaceAll("\r\n", "\n");
  const marker = "\ntry {\n  await bootstrap();";
  if (!baseline.includes(marker)) throw new Error("Review changed trusted SQL bootstrap");
  let source = baseline.slice(0, baseline.indexOf(marker));
  source = source.replace('const packageRoot = process.argv.find((arg) => arg.startsWith("--pglite-root="))?.slice("--pglite-root=".length);', `const packageRoot = ${JSON.stringify(resolve(packageRoot))};`);
  source = source.replace("new URL(`../../../supabase/migrations/${file}`, import.meta.url)", `new URL(file, ${JSON.stringify(pathToFileURL(join(repositoryRoot, "supabase/migrations/")).href)})`);
  source += "\nexport {db, bootstrap, sql, as, one, ids};\n";
  const directory = await mkdtemp(join(tmpdir(), "einvoice-local-sql-"));
  const runtime = join(directory, "trusted-bootstrap.mjs");
  let state;
  try {
    await writeFile(runtime, source);
    state = await import(pathToFileURL(runtime).href);
    await state.bootstrap();
    const { db, sql, one, as, ids } = state;
    await db.exec("alter table accounting_accounts add column if not exists code text,add column if not exists name text;alter table accounting_entries add column if not exists total_debit numeric,add column if not exists total_credit numeric,add column if not exists posted_at timestamptz,add column if not exists posted_by uuid,add column if not exists created_by uuid;alter table accounting_entry_lines add column if not exists account_id uuid references accounting_accounts(id),add column if not exists account_code text,add column if not exists account_label text,add column if not exists line_number integer,add column if not exists debit numeric,add column if not exists credit numeric,add column if not exists label text;");
    await db.exec("do $$begin create role service_role bypassrls;exception when duplicate_object then null;end $$;");
    let migrationSha256, operationsMigrationSha256 = null;
    for (const file of ["024_customer_credit_notes_return_source.sql", "041_create_organization_with_owner_rpc.sql", "097_document_numbering_controls.sql", "098_essential_finance_integrity.sql", "099_essential_subscription_access.sql", "100_essential_credit_note_corrections.sql", "101_essential_supplier_credit_notes.sql", "102_electronic_invoicing_maroc.sql", ...(operations ? ["103_electronic_invoicing_operations.sql"] : [])]) {
      const content=await sql(file);await db.exec(content);
      if(file==="102_electronic_invoicing_maroc.sql")migrationSha256=createHash("sha256").update(content).digest("hex");
      if(file==="103_electronic_invoicing_operations.sql")operationsMigrationSha256=createHash("sha256").update(content).digest("hex");
    }
    await db.exec(await sql("047_app_notifications.sql"));
    await db.exec("alter table profiles add column if not exists first_name text,add column if not exists last_name text,add column if not exists avatar_url text;grant usage on schema public,auth,app_private to service_role;grant select on all tables in schema public to service_role;grant select,insert,update on app_notifications to authenticated;grant insert,update on app_notifications to service_role;");
    Object.assign(ids, {
      org: "10000000-0000-4000-8000-000000000102", foreign: "10000000-0000-4000-8000-000000000103",
      admin: "20000000-0000-4000-8000-000000000102", operator: "20000000-0000-4000-8000-000000000103",
      viewer: "20000000-0000-4000-8000-000000000104", outsider: "20000000-0000-4000-8000-000000000105",
    });
    for (const [id, name] of [[ids.org, "PRÉPRODUCTION LOCALE — Société fictive"], [ids.foreign, "Autre entreprise fictive locale"]]) {
      await db.query("insert into organizations(id,name,slug,onboarding_completed,onboarding_step) values($1::uuid,$2,$1::text,true,'completed')", [id, name]);
    }
    const users = [];
    for (const roleName of ["admin", "operator", "viewer", "outsider"]) {
      const id = ids[roleName];
      const org = roleName === "outsider" ? ids.foreign : ids.org;
      const role = roleName === "outsider" ? "admin" : roleName;
      const email = `${roleName}@einvoice-local.example.test`;
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, email]);
      await db.query("insert into profiles(id,email,full_name,default_organization_id) values($1,$2,$3,$4)", [id, email, `Recette locale ${roleName}`, org]);
      const record = await one("insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name)do update set name=excluded.name returning id", [org, role]);
      await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [org, id, record.id]);
      users.push({ id, email, role, organizationId: org });
    }
    await db.query("insert into company_settings(organization_id,legal_name,address,city,country,ice,if_number,rc) values($1,'Société fictive اختبار — NE PAS TRANSMETTRE','1 rue de la Recette fictive','Casablanca','Maroc','123456789012345','12345678','RC-TEST-LOCAL') on conflict(organization_id)do update set legal_name=excluded.legal_name,address=excluded.address,ice=excluded.ice", [ids.org]);
    const customer = await one("insert into third_parties(organization_id,primary_type,types,name,address,city,country,ice,if_number,rc) values($1,'customer',array['customer'],'Client fictif اختبار','2 rue de la Recette fictive','Rabat','Maroc','543210987654321','87654321','RC-CLIENT-TEST') returning id", [ids.org]);
    await as(ids.outsider); await one("select ensure_essential_trial($1)", [ids.foreign]);
    const foreignCustomer = await one("insert into third_parties(organization_id,primary_type,types,name) values($1,'customer',array['customer'],'Client autre entreprise fictive')returning id", [ids.foreign]);
    const foreignInvoice = await one("select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb) id", [ids.foreign, JSON.stringify({customer_id: foreignCustomer.id}), JSON.stringify([{description:"Service autre organisation",quantity:"1.000",unit_price_ht:"50.00",discount_rate:"0.00",tax_rate:"20.00"}])]);
    await as(ids.admin); await one("select ensure_essential_trial($1)", [ids.org]);
    const lines = [
      { description: "Conseil et prestation اختبار", quantity: "2.000", unit_price_ht: "100.00", discount_rate: "10.00", tax_rate: "20.00" },
      { description: "Prestation au taux réduit — fixture fictive", quantity: "1.500", unit_price_ht: "80.00", discount_rate: "0.00", tax_rate: "10.00" },
      { description: "Ligne exonérée — motif fictif de recette à renseigner", quantity: "1.000", unit_price_ht: "40.00", discount_rate: "0.00", tax_rate: "0.00" },
    ];
    const invoice = await one("select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb) id", [ids.org, JSON.stringify({customer_id:customer.id,invoice_date:"2026-10-31",notes:"Document fictif de recette locale. Aucune transmission fiscale."}), JSON.stringify(lines)]);
    await db.query("update customer_invoices set status='validated' where id=$1", [invoice.id]);
    const invoiceLines = (await db.query("select id,tax_rate::text from customer_invoice_lines where invoice_id=$1 order by line_order", [invoice.id])).rows;
    const draft = await one("select save_customer_invoice_atomic($1,null,$2::jsonb,$3::jsonb) id", [ids.org, JSON.stringify({customer_id:customer.id,invoice_date:"2026-10-31"}), JSON.stringify([lines[0]])]);
    const credit = await one("select save_customer_credit_note_atomic($1,null,$2::jsonb,$3::jsonb) id", [ids.org, JSON.stringify({customer_id:customer.id,source_invoice_id:invoice.id,credit_note_date:"2026-10-31",reason:"Correction partielle fictive de recette locale",notes:"Avoir fictif. Aucun envoi à la DGI."}), JSON.stringify([{...lines[0],quantity:"0.500",source_invoice_line_id:invoiceLines[0].id}])]);
    await db.query("update customer_credit_notes set status='validated',available_amount=total_ttc where id=$1", [credit.id]);
    await one("select einvoice_update_settings($1,$2,'disabled',$3::jsonb,null)", [ids.org, !operations, JSON.stringify({alerts_enabled:true})]);
    await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)");
    return { db, users, ids: { organizationId:ids.org, foreignOrganizationId:ids.foreign, customerId:customer.id, invoiceId:invoice.id, invoiceLines, draftInvoiceId:draft.id, creditNoteId:credit.id, foreignInvoiceId:foreignInvoice.id }, migrationSha256, operationsMigrationSha256, engine:"PostgreSQL via isolated in-memory PGlite" };
  } catch (error) {
    await state?.db.close();
    throw error;
  } finally {
    await rm(runtime, { force:true });
    await rmdir(directory);
  }
}
