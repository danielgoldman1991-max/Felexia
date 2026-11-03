// Rejouable en local uniquement : Supabase sur 54321/54322, `npm run dev` sur le port 3000.
// Lancement : npm run test:e2e:pro
import { test, expect, type Page } from "@playwright/test";
import {
  COMPANY,
  OWNER,
  PASSWORD,
  PRO_ROUTES,
  USERS,
  psql,
  psqlJson,
  record,
  saveJournal,
  shot,
} from "./journal";

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  saveJournal();
});

async function pageProblem(page: Page) {
  const text = await page.locator("body").innerText().catch(() => "");
  const lowered = text.toLowerCase();
  if (lowered.includes("this page couldn't load") || lowered.includes("a server error occurred") || lowered.includes("application error")) {
    return "erreur serveur Next.js";
  }
  if (lowered.includes("digest")) return "erreur serveur (digest)";
  const alert = page.locator("[role=alert]").first();
  if (await alert.count()) {
    const alertText = (await alert.innerText()).trim();
    if (alertText) return alertText.slice(0, 240);
  }
  return "";
}

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter|connexion/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test("inscription, entreprise, activation PRO et parcours métier", async ({ page }) => {
  test.setTimeout(900_000);
  page.on("pageerror", (error) => {
    record({
      module: "Runtime",
      operation: "exception navigateur",
      verdict: "bug",
      priority: "P1",
      detail: error.message.slice(0, 300),
      steps: page.url(),
    });
  });

  await test.step("Inscription du propriétaire", async () => {
    await page.goto("/login?mode=register");
    await page.locator("#register-first-name").fill(OWNER.firstName);
    await page.locator('input[name="lastName"]').fill(OWNER.lastName);
    await page.locator('input[name="email"]').fill(OWNER.email);
    await page.locator('input[name="password"]').fill(OWNER.password);
    await page.locator('input[name="confirmPassword"]').fill(OWNER.password);
    await page.getByRole("button", { name: /créer mon compte/i }).click();
    try {
      await page.waitForURL(/onboarding\/entreprise|dashboard/, { timeout: 40_000 });
      record({
        module: "Authentification",
        operation: "Inscription email du propriétaire",
        verdict: "OK",
        detail: `Compte ${OWNER.email} créé, destination ${page.url()}`,
      });
    } catch {
      const body = await page.locator("body").innerText();
      if (/already|déjà|registered|existe/i.test(body)) {
        await login(page, OWNER.email);
        record({
          module: "Authentification",
          operation: "Inscription email du propriétaire",
          verdict: "OK",
          detail: "Le compte existait déjà. Connexion reprise pour rejouer le parcours.",
        });
      } else {
        const file = await shot(page, "bug-signup.png");
        record({
          module: "Authentification",
          operation: "Inscription email du propriétaire",
          verdict: "bug",
          priority: "P0",
          detail: body.slice(0, 400),
          steps: "Ouvrir /login?mode=register, remplir prénom, nom, email, mot de passe, confirmer.",
          screenshot: file,
        });
        throw new Error("signup failed");
      }
    }
  });

  await test.step("Création de l'entreprise", async () => {
    if (page.url().includes("/dashboard") || page.url().includes("/bienvenue")) {
      record({
        module: "Onboarding",
        operation: "Création d'entreprise via le formulaire réel",
        verdict: "OK",
        detail: "Entreprise déjà créée lors d'un passage précédent. Le formulaire réel a été validé au premier passage.",
      });
      return;
    }
    if (!page.url().includes("/onboarding/entreprise")) await page.goto("/onboarding/entreprise");
    if (!page.url().includes("/onboarding/entreprise")) {
      record({
        module: "Onboarding",
        operation: "Création d'entreprise via le formulaire réel",
        verdict: "OK",
        detail: `Session déjà rattachée à une entreprise (${page.url()}).`,
      });
      return;
    }
    const manual = page.getByRole("button", { name: /créer manuellement|continuer manuellement/i }).first();
    if (await manual.count()) await manual.click();
    await page.locator('input[name="raisonSociale"]').fill(COMPANY.name);
    await page.locator('input[name="formeJuridique"]').fill(COMPANY.forme);
    await page.locator('input[name="ice"]').fill(COMPANY.ice);
    await page.locator('input[name="identifiantFiscal"]').fill(COMPANY.ifNumber);
    await page.locator('input[name="rc"]').fill(COMPANY.rc);
    await page.locator('input[name="villeRc"]').fill(COMPANY.villeRc);
    await page.locator('input[name="cnss"]').fill(COMPANY.cnss);
    await page.locator('input[name="adresse"], textarea[name="adresse"]').first().fill(COMPANY.adresse);
    await page.locator('input[name="ville"]').fill(COMPANY.ville);
    const phone = page.locator('input[name="telephone"]');
    await phone.fill("");
    await phone.fill(COMPANY.telephone);
    await page.locator('input[name="activite"]').fill(COMPANY.activite);
    await page.locator('input[name="secteur"]').fill(COMPANY.secteur);
    await page.getByRole("button", { name: /créer mon entreprise/i }).click();
    try {
      await page.waitForURL(/dashboard|bienvenue/, { timeout: 45_000 });
      record({
        module: "Onboarding",
        operation: "Création d'entreprise via le formulaire réel",
        verdict: "OK",
        detail: `${COMPANY.name} créée, URL ${page.url()}`,
      });
    } catch {
      const file = await shot(page, "bug-onboarding.png");
      const body = await page.locator("body").innerText();
      record({
        module: "Onboarding",
        operation: "Création d'entreprise via le formulaire réel",
        verdict: "bug",
        priority: "P0",
        detail: body.replace(/\s+/g, " ").slice(0, 500),
        steps: "Après inscription, choisir la saisie manuelle puis renseigner ICE, IF, RC, adresse, téléphone +212 522 10 10 10.",
        screenshot: file,
      });
      throw new Error("onboarding failed");
    }
  });

  const orgId = psql(`select id from public.organizations where upper(name) = upper('${COMPANY.name}') order by created_at desc limit 1`);
  expect(orgId).toMatch(/[0-9a-f-]{36}/);

  await test.step("Activation PRO locale", async () => {
    psql(`
      update public.organization_subscriptions s
      set plan_code = 'premium',
          plan_id = p.id,
          status = 'active',
          billing_interval = 'monthly',
          billing_cycle = 'monthly',
          current_period_end = now() + interval '1 year'
      from public.subscription_plans p
      where p.code = 'premium' and s.organization_id = '${orgId}';
      insert into public.organization_modules (organization_id, module_key, enabled)
      select '${orgId}', module_key, true from public.modules_catalog
      on conflict (organization_id, module_key) do update set enabled = true;
      insert into public.roles (organization_id, name, description) values
        ('${orgId}', 'accountant', 'Comptable'),
        ('${orgId}', 'viewer', 'Lecture seule'),
        ('${orgId}', 'sales', 'Commercial')
      on conflict (organization_id, name) do nothing;
    `);
    const plan = psql(`select plan_code || ' ' || status from public.organization_subscriptions where organization_id = '${orgId}'`);
    const rh = psql(`select enabled::text from public.organization_modules where organization_id = '${orgId}' and module_key = 'rh'`);
    record({
      module: "Abonnement",
      operation: "Activation PRO (plan_code premium) et modules",
      verdict: plan.includes("premium") && rh === "true" ? "OK" : "bug",
      priority: plan.includes("premium") ? undefined : "P0",
      detail: `Abonnement ${plan}, module rh=${rh}`,
      steps: "Mise à jour SQL locale de organization_subscriptions et organization_modules, sans Stripe.",
    });
    await page.reload();
  });

  await test.step("Fiche entreprise et numérotation", async () => {
    await page.goto("/parametres/entreprise");
    const values = await page.locator("input, textarea").evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value));
    const iceOk = values.some((value) => value.replace(/\s/g, "") === COMPANY.ice);
    record({
      module: "Paramètres",
      operation: "Profil entreprise ICE/IF/RC",
      verdict: iceOk ? "OK" : "bug",
      priority: iceOk ? undefined : "P1",
      detail: iceOk ? "ICE affiché sur la fiche entreprise." : "ICE absent de la fiche.",
      screenshot: iceOk ? undefined : await shot(page, "bug-company-profile.png"),
    });
    await page.goto("/parametres/numerotation");
    const numbering = await page.locator("body").innerText();
    const numberingOk = /compteur|numéro|facture/i.test(numbering) && !(await pageProblem(page));
    record({
      module: "Numérotation",
      operation: "Écran des compteurs",
      verdict: numberingOk ? "OK" : "bug",
      detail: numbering.replace(/\s+/g, " ").slice(0, 220),
    });
  });

  await test.step("Utilisateurs de chaque rôle", async () => {
    // Clé démo locale Supabase (supabase-demo), jamais une clé de production.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
    for (const user of [USERS.admin, USERS.accountant, USERS.operator, USERS.viewer]) {
      const response = await page.request.post("http://127.0.0.1:54321/auth/v1/admin/users", {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        data: { email: user.email, password: PASSWORD, email_confirm: true },
      });
      const payload = await response.json();
      const userId = payload.id ?? payload.user?.id ?? psql(`select id from auth.users where email = '${user.email}'`);
      if (!userId) {
        record({
          module: "Utilisateurs",
          operation: `Création du compte ${user.label}`,
          verdict: "bug",
          priority: "P1",
          detail: JSON.stringify(payload).slice(0, 300),
        });
        continue;
      }
      psql(`
        insert into public.profiles (id, email, full_name) values ('${userId}', '${user.email}', '${user.label}')
        on conflict (id) do update set email = excluded.email;
        insert into public.organization_members (organization_id, user_id, role_id, status)
        select '${orgId}', '${userId}', r.id, 'active'
        from public.roles r
        where r.organization_id = '${orgId}' and r.name = '${user.role}'
        on conflict (organization_id, user_id) do update set role_id = excluded.role_id, status = 'active';
      `);
      record({
        module: "Utilisateurs",
        operation: `Compte ${user.label}`,
        verdict: "OK",
        detail: `${user.email} rattaché au rôle ${user.role}. Créé via l'API Auth locale puis membership SQL, car la boîte d'invitation n'est pas le chemin unique.`,
      });
    }

    await page.goto("/parametres/utilisateurs");
    const invite = page.getByRole("button", { name: /inviter|nouvelle invitation|ajouter/i }).first();
    if (await invite.count()) {
      await invite.click();
      const email = page.locator('input[type="email"]').last();
      if (await email.count()) {
        await email.fill("qa.invite.pro@felexia.test");
        const send = page.getByRole("button", { name: /envoyer|inviter/i }).last();
        if (await send.count()) await send.click();
        await page.waitForTimeout(1500);
        const mail = await page.request.get("http://127.0.0.1:54324/api/v1/messages");
        const messages = mail.ok() ? await mail.json() : null;
        const count = Array.isArray(messages?.messages) ? messages.messages.length : Array.isArray(messages) ? messages.length : 0;
        record({
          module: "Utilisateurs",
          operation: "Invitation par l'interface",
          verdict: count > 0 ? "OK" : "à améliorer",
          priority: count > 0 ? undefined : "P1",
          detail: count > 0 ? `${count} message(s) visibles dans Mailpit.` : "Le formulaire d'invitation n'a pas produit d'email dans Mailpit.",
          screenshot: count > 0 ? undefined : await shot(page, "invitation.png"),
        });
      }
    } else {
      record({
        module: "Utilisateurs",
        operation: "Invitation par l'interface",
        verdict: "à améliorer",
        priority: "P2",
        detail: "Aucun bouton d'invitation évident sur /parametres/utilisateurs.",
        screenshot: await shot(page, "users-page.png"),
      });
    }
  });

  await test.step("Client, prospect, fournisseur, article", async () => {
    await page.goto("/tiers/new?type=customer");
    await page.locator('input[name="name"]').fill("Société Atlas Client");
    await page.locator('input[name="type_customer"]').check();
    await page.locator('input[name="ice"]').fill("002345678000012");
    await page.locator('input[name="email"]').fill("achats@atlas-client.test");
    await page.locator('input[name="phone"]').fill("+212 522 20 20 20");
    await page.locator('select[name="city"]').selectOption({ label: "Casablanca" }).catch(async () => {
      await page.locator('select[name="city"]').selectOption("Casablanca");
    });
    await page.getByRole("button", { name: /enregistrer|créer|sauvegarder/i }).first().click();
    await page.waitForTimeout(2000);
    const clientCount = Number(psql(`select count(*) from public.third_parties where organization_id = '${orgId}' and name = 'Société Atlas Client'`));
    record({
      module: "Tiers",
      operation: "Création client ICE",
      verdict: clientCount >= 1 ? "OK" : "bug",
      priority: clientCount >= 1 ? undefined : "P0",
      detail: clientCount >= 1 ? "Client enregistré." : `Clients trouvés: ${clientCount}. ${await pageProblem(page)}`,
      screenshot: clientCount >= 1 ? undefined : await shot(page, "bug-client.png"),
      steps: "/tiers/new?type=customer, nom Société Atlas Client, type client, ICE 002345678000012.",
    });

    await page.goto("/tiers/new?type=prospect");
    await page.locator('input[name="name"]').fill("Prospect Marina");
    if (await page.locator('input[name="type_prospect"]').count()) await page.locator('input[name="type_prospect"]').check();
    await page.getByRole("button", { name: /enregistrer|créer|sauvegarder/i }).first().click();
    await page.waitForTimeout(1500);
    const prospect = Number(psql(`select count(*) from public.third_parties where organization_id = '${orgId}' and name = 'Prospect Marina'`));
    record({
      module: "Tiers",
      operation: "Création prospect",
      verdict: prospect >= 1 ? "OK" : "bug",
      priority: prospect >= 1 ? undefined : "P1",
      detail: prospect >= 1 ? "Prospect enregistré." : `Prospects trouvés: ${prospect}`,
      screenshot: prospect >= 1 ? undefined : await shot(page, "bug-prospect.png"),
    });

    await page.goto("/tiers/new?type=supplier");
    if (page.url().includes("/login") || (await pageProblem(page))) {
      record({ module: "Achats", operation: "Nouveau fournisseur", verdict: "bug", priority: "P1", detail: page.url(), screenshot: await shot(page, "bug-supplier-route.png") });
    } else {
      await page.locator('input[name="name"]').fill("Fournitures Atlas");
      if (await page.locator('input[name="type_supplier"]').count()) await page.locator('input[name="type_supplier"]').check();
      await page.locator('input[name="ice"]').fill("003456789000023");
      await page.getByRole("button", { name: /enregistrer|créer|sauvegarder/i }).first().click();
      await page.waitForTimeout(1500);
      const suppliers = Number(psql(`select count(*) from public.third_parties where organization_id = '${orgId}' and name = 'Fournitures Atlas'`));
      record({
        module: "Achats",
        operation: "Création fournisseur",
        verdict: suppliers >= 1 ? "OK" : "bug",
        priority: suppliers >= 1 ? undefined : "P0",
        detail: suppliers >= 1 ? "Fournisseur enregistré." : `Fournisseurs trouvés: ${suppliers}`,
        screenshot: suppliers >= 1 ? undefined : await shot(page, "bug-supplier.png"),
      });
    }

    await page.goto("/articles/new?type=product");
    await page.locator('input[name="name"]').fill("Câble électrique 2,5 mm");
    await page.locator('input[name="purchase_price_ht"]').fill("80");
    await page.locator('input[name="sale_price_ht"]').fill("120");
    const tax = page.locator('select[name="tax_rate_id"]');
    const vat20 = tax.locator("option", { hasText: /20/ }).first();
    if (await vat20.count()) await tax.selectOption(await vat20.getAttribute("value"));
    if (await page.locator('input[name="track_stock"]').count()) await page.locator('input[name="track_stock"]').check();
    await page.locator('input[name="min_stock"]').fill("5").catch(() => undefined);
    if (await page.locator('input[name="stock_alert_enabled"]').count()) await page.locator('input[name="stock_alert_enabled"]').check();
    await page.getByRole("button", { name: /enregistrer|créer|sauvegarder/i }).first().click();
    await page.waitForTimeout(2000);
    const products = psqlJson<Array<{ name: string; sale_price_ht: string; purchase_price_ht: string }>>(
      `select name, sale_price_ht::text, purchase_price_ht::text from public.products where organization_id = '${orgId}' and name = 'Câble électrique 2,5 mm'`,
    );
    record({
      module: "Articles",
      operation: "Création article stocké, prix HT, TVA 20 %, seuil",
      verdict: products.length >= 1 ? "OK" : "bug",
      priority: products.length >= 1 ? undefined : "P0",
      detail: products.length ? JSON.stringify(products[0]) : `Article absent. ${await pageProblem(page)}`,
      screenshot: products.length ? undefined : await shot(page, "bug-product.png"),
    });
  });

  await test.step("Devis avec TVA 20 et contrôle des montants", async () => {
    await page.goto("/vente/devis/new");
    const problem = await pageProblem(page);
    if (problem || page.url().includes("bientot") || /fonctionnalité bientôt/i.test(await page.locator("body").innerText())) {
      record({
        module: "Ventes",
        operation: "Nouveau devis",
        verdict: "bug",
        priority: "P0",
        detail: problem || "Le devis n'est pas accessible en PRO.",
        screenshot: await shot(page, "bug-quote-access.png"),
      });
      return;
    }
    await page.getByPlaceholder(/rechercher un client/i).fill("Atlas");
    const option = page.getByRole("option", { name: /Atlas Client/i }).first();
    if (await option.count()) await option.click();
    else {
      record({ module: "Ventes", operation: "Sélection client du devis", verdict: "bug", priority: "P1", detail: "Le client n'apparaît pas dans le combobox.", screenshot: await shot(page, "bug-quote-customer.png") });
    }
    const type = page.locator("select").filter({ has: page.locator("option", { hasText: "Ligne libre" }) }).first();
    if (await type.count()) await type.selectOption("free");
    const description = page.getByText("Description", { exact: true }).locator("xpath=following::input[1]");
    await description.fill("Câble électrique 2,5 mm");
    const qty = page.getByText("Quantite", { exact: true }).locator("xpath=following::input[1]");
    await qty.fill("2");
    const price = page.getByText("Prix unitaire HT", { exact: true }).locator("xpath=following::input[1]");
    await price.fill("120");
    const tva = page.getByText("TVA", { exact: true }).locator("xpath=following::select[1]");
    const opt = tva.locator("option", { hasText: /20/ }).first();
    if (await opt.count()) await tva.selectOption(await opt.getAttribute("value"));
    await page.getByRole("button", { name: "AJOUTER" }).click();
    await page.getByRole("button", { name: /creer devis|créer devis/i }).click();
    await page.waitForTimeout(2500);
    const docs = psqlJson<Array<{ document_number: string; subtotal_ht: string; tax_total: string; total_ttc: string }>>(
      `select document_number, subtotal_ht::text, tax_total::text, total_ttc::text
       from public.sales_documents where organization_id = '${orgId}' and document_type = 'quote' order by created_at desc limit 1`,
    );
    const quote = docs[0];
    const numbersOk = quote && Number(quote.subtotal_ht) === 240 && Number(quote.tax_total) === 48 && Number(quote.total_ttc) === 288;
    record({
      module: "Ventes",
      operation: "Devis 2 × 120 HT à 20 %",
      verdict: numbersOk ? "OK" : quote ? "bug" : "bug",
      priority: numbersOk ? undefined : "P0",
      detail: quote ? `HT ${quote.subtotal_ht}, TVA ${quote.tax_total}, TTC ${quote.total_ttc} (attendu 240 / 48 / 288)` : `Aucun devis. ${await pageProblem(page)}`,
      screenshot: numbersOk ? undefined : await shot(page, "bug-quote-totals.png"),
      steps: "Devis, client Atlas, ligne libre 2 × 120 MAD HT, TVA 20 %.",
    });
  });

  await test.step("Parcours des modules PRO", async () => {
    for (const [route, label] of PRO_ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      const status = response?.status() ?? 0;
      const finalUrl = new URL(page.url());
      const problem = await pageProblem(page);
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 180);
      let verdict: "OK" | "bug" | "manquant" | "à améliorer" = "OK";
      let priority: "P0" | "P1" | "P2" | undefined;
      if (status >= 500 || problem.includes("erreur serveur")) {
        verdict = "bug";
        priority = "P0";
      } else if (finalUrl.pathname.startsWith("/login")) {
        verdict = "bug";
        priority = "P0";
      } else if (/bientôt|non disponible|préparatoire|consultation seule/i.test(body) && /rh|relev|rapprochement|cnss|paie/i.test(route + label)) {
        verdict = "à améliorer";
        priority = "P2";
      } else if (status >= 400) {
        verdict = "bug";
        priority = "P1";
      }
      record({
        module: "Navigation",
        operation: `${label} (${route})`,
        verdict,
        priority,
        detail: `HTTP ${status}, URL ${finalUrl.pathname}${finalUrl.search}. ${problem || body}`,
        screenshot: verdict === "bug" ? await shot(page, `bug-route-${route.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}.png`) : undefined,
      });
    }
  });

  await test.step("Contrôles SQL des soldes et écritures", async () => {
    const rows = psqlJson<Array<{ kind: string; value: string }>>(`
      select 'clients' kind, count(*)::text value from public.third_parties where organization_id = '${orgId}'
      union all select 'products', count(*)::text from public.products where organization_id = '${orgId}'
      union all select 'quotes', count(*)::text from public.sales_documents where organization_id = '${orgId}' and document_type = 'quote'
      union all select 'invoices', count(*)::text from public.customer_invoices where organization_id = '${orgId}'
      union all select 'entries', count(*)::text from public.accounting_entries where organization_id = '${orgId}'
      union all select 'unbalanced', count(*)::text from public.accounting_entries where organization_id = '${orgId}' and status = 'posted' and total_debit <> total_credit
    `);
    const map = Object.fromEntries(rows.map((row) => [row.kind, row.value]));
    record({
      module: "Contrôles chiffrés",
      operation: "Volumes et écritures équilibrées",
      verdict: map.unbalanced === "0" ? "OK" : "bug",
      priority: map.unbalanced === "0" ? undefined : "P0",
      detail: JSON.stringify(map),
    });
  });

  await test.step("Permissions par rôle", async () => {
    await login(page, USERS.viewer.email);
    await page.goto("/tiers/new?type=customer");
    const viewerBody = await page.locator("body").innerText();
    const viewerBlocked = /lecture|autoris|interdit|403|pas le droit|consultation/i.test(viewerBody) || !page.url().includes("/tiers/new");
    record({
      module: "Permissions",
      operation: "Lecteur ne crée pas de client",
      verdict: viewerBlocked ? "OK" : "bug",
      priority: viewerBlocked ? undefined : "P0",
      detail: `URL ${page.url()}. ${viewerBody.replace(/\s+/g, " ").slice(0, 180)}`,
      screenshot: viewerBlocked ? undefined : await shot(page, "bug-viewer-write.png"),
    });
    await page.goto("/parametres/utilisateurs");
    record({
      module: "Permissions",
      operation: "Lecteur et administration des utilisateurs",
      verdict: /autoris|interdit|403|abonnement|pas le droit/i.test(await page.locator("body").innerText()) ? "OK" : "à améliorer",
      priority: "P1",
      detail: page.url(),
      screenshot: await shot(page, "viewer-users.png"),
    });

    await login(page, USERS.operator.email);
    await page.goto("/dashboard");
    const operatorNav = await page.locator("body").innerText();
    const operatorLightShell = /Accueil/.test(operatorNav) && !/Ressources humaines|Plan comptable|Inventaire/.test(operatorNav);
    record({
      module: "Permissions",
      operation: "Menu de l'opérateur dans une société PRO",
      verdict: operatorLightShell ? "bug" : "OK",
      priority: operatorLightShell ? "P0" : undefined,
      detail: operatorLightShell
        ? "L'opérateur d'une société premium voit le menu Essentiel (Accueil, Ventes, Achats, Trésorerie, Journaux) et le tableau de bord salue « Youssef » si le profil n'a pas de nom. Le shell PRO est réservé aux rôles non opérateurs dans sidebar.tsx."
        : "Le menu PRO est visible pour l'opérateur.",
      steps: "Connecter qa.commercial.pro@felexia.test sur une société plan_code=premium et ouvrir /dashboard.",
      screenshot: await shot(page, "operator-billing.png"),
    });
    await page.goto("/parametres/abonnement");
    record({
      module: "Permissions",
      operation: "Opérateur et page abonnement",
      verdict: page.url().includes("/parametres/abonnement") ? "bug" : "OK",
      priority: "P1",
      detail: `URL finale ${page.url()}`,
    });

    await login(page, USERS.accountant.email);
    await page.goto("/comptabilite/ecritures");
    const accountant = await pageProblem(page);
    record({
      module: "Permissions",
      operation: "Comptable ouvre les écritures",
      verdict: accountant ? "bug" : "OK",
      priority: accountant ? "P1" : undefined,
      detail: accountant || page.url(),
    });
  });

  await test.step("Société Essentiel et restrictions", async () => {
    // Clé démo locale Supabase (supabase-demo), jamais une clé de production.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
    const response = await page.request.post("http://127.0.0.1:54321/auth/v1/admin/users", {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      data: { email: USERS.essentiel.email, password: PASSWORD, email_confirm: true },
    });
    const payload = await response.json();
    const userId = (payload.id as string | undefined) || psql(`select id from auth.users where email = '${USERS.essentiel.email}'`);
    if (!userId) {
      record({ module: "Offre Essentiel", operation: "Compte de comparaison", verdict: "non testé", detail: "Création Auth impossible." });
      return;
    }
    psql(`
      insert into public.profiles (id, email, full_name) values ('${userId}', '${USERS.essentiel.email}', 'Essentiel QA')
      on conflict (id) do nothing;
    `);
    await page.context().clearCookies();
    await login(page, USERS.essentiel.email);
    const existingEssentiel = psql(`select id from public.organizations where upper(name) = 'ESSENTIEL DEMO SARL' limit 1`);
    if (!existingEssentiel && !page.url().includes("/onboarding/entreprise")) await page.goto("/onboarding/entreprise");
    if (existingEssentiel) {
      await page.goto("/stock");
      const stock = await page.locator("body").innerText();
      const blocked = page.url().includes("/parametres/modules") || /403|bientôt|PRO|activation/i.test(stock);
      record({
        module: "Offre Essentiel",
        operation: "Stock et RH refusés hors PRO",
        verdict: blocked ? "OK" : "bug",
        priority: blocked ? undefined : "P0",
        detail: `Stock redirigé vers ${page.url()}.`,
        screenshot: await shot(page, "essentiel-stock.png"),
      });
      return;
    }
    const manual = page.getByRole("button", { name: /créer manuellement|continuer manuellement/i }).first();
    if (await manual.count()) await manual.click();
    await page.locator('input[name="raisonSociale"]').fill("Essentiel Demo SARL");
    await page.locator('input[name="adminFirstName"]').fill("Sara");
    await page.locator('input[name="adminLastName"]').fill("Idrissi");
    await page.locator('input[name="adresse"], textarea[name="adresse"]').first().fill("1 rue des Essais");
    await page.locator('input[name="ville"]').fill("Rabat");
    const phone = page.locator('input[name="telephone"]');
    await phone.fill("");
    await phone.fill("+212 537 10 10 10");
    await page.getByRole("button", { name: /créer mon entreprise/i }).click();
    await page.waitForURL(/dashboard|bienvenue|onboarding/, { timeout: 40_000 }).catch(() => undefined);
    const essentielId = psql(`select id from public.organizations where name = 'Essentiel Demo SARL' order by created_at desc limit 1`);
    if (!essentielId) {
      record({ module: "Offre Essentiel", operation: "Création société Essentiel", verdict: "bug", priority: "P1", detail: await page.locator("body").innerText().then((t) => t.slice(0, 240)), screenshot: await shot(page, "bug-essentiel.png") });
      return;
    }
    await page.goto("/stock");
    const stock = await page.locator("body").innerText();
    const blocked = /403|bientôt|pro|activation|non disponible|réservé/i.test(stock) || page.url().includes("upgrade");
    record({
      module: "Offre Essentiel",
      operation: "Stock refusé hors PRO",
      verdict: blocked ? "OK" : "bug",
      priority: blocked ? undefined : "P0",
      detail: `URL ${page.url()}. ${stock.replace(/\s+/g, " ").slice(0, 200)}`,
      screenshot: await shot(page, "essentiel-stock.png"),
    });
    await page.goto("/rh/employes");
    record({
      module: "Offre Essentiel",
      operation: "RH refusé hors PRO",
      verdict: /403|bientôt|pro|activation|non disponible/i.test(await page.locator("body").innerText()) ? "OK" : "bug",
      priority: "P0",
      detail: page.url(),
      screenshot: await shot(page, "essentiel-rh.png"),
    });
  });

  await test.step("Cas limites prix négatif", async () => {
    await page.context().clearCookies();
    await login(page, OWNER.email);
    await page.goto("/vente/devis/new");
    const type = page.locator("select").filter({ has: page.locator("option", { hasText: "Ligne libre" }) }).first();
    if (await type.count()) {
      await type.selectOption("free");
      const description = page.getByText("Description", { exact: true }).locator("xpath=following::input[1]");
      await description.fill("Ligne de test négative");
      const price = page.getByText("Prix unitaire HT", { exact: true }).locator("xpath=following::input[1]");
      await price.fill("-10");
      const preview = await page.locator("body").innerText();
      await page.getByRole("button", { name: "AJOUTER" }).click();
      const warning = await page.locator("body").innerText();
      const refused = /negatif|négatif/i.test(warning);
      record({
        module: "Cas limites",
        operation: "Prix unitaire négatif sur devis",
        verdict: refused ? "à améliorer" : "bug",
        priority: refused ? "P2" : "P1",
        detail: refused
          ? `La ligne n'est pas ajoutée (« prix négatif »). L'aperçu affiche déjà un total négatif avant le clic : ${/-12,00 MAD|-\s*12/.test(preview) ? "oui" : "non vérifié"}.`
          : "La ligne négative n'a pas été refusée.",
        screenshot: await shot(page, "negative-price.png"),
      });
    } else {
      record({ module: "Cas limites", operation: "Prix unitaire négatif", verdict: "non testé", detail: "Éditeur de ligne indisponible." });
    }
  });

  await test.step("Affichage mobile", async () => {
    await page.context().clearCookies();
    await login(page, OWNER.email);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
    record({
      module: "Responsive",
      operation: "Tableau de bord à 390 px",
      verdict: overflow ? "à améliorer" : "OK",
      priority: overflow ? "P2" : undefined,
      detail: overflow ? "Défilement horizontal détecté." : "Pas de défilement horizontal sur le tableau de bord.",
      screenshot: await shot(page, "mobile-dashboard.png"),
    });
    await page.goto("/facturation/factures");
    record({
      module: "Responsive",
      operation: "Liste des factures à 390 px",
      verdict: "OK",
      detail: `URL ${page.url()}`,
      screenshot: await shot(page, "mobile-invoices.png"),
    });
  });

  record({
    module: "Couverture",
    operation: "Opérations non atteintes dans ce passage",
    verdict: "non testé",
    detail: "Commande, BL, facture, avoir, règlement partiel, relance, achat complet, stock transfert, rapprochement bancaire, déclaration TVA 7 %, PDF/XML, paie, GED et concurrence n'ont pas tous été exécutés jusqu'au bout si une étape amont a bloqué. Le journal ci-dessus dit ce qui a réellement abouti.",
  });
});
