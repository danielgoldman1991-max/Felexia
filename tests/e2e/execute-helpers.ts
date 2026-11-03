import type { Page } from "@playwright/test";
import { OWNER, PASSWORD, USERS, psql, psqlJson, record, shot, type Finding, type Verdict } from "./journal";

export const ORG_SQL = `select id from public.organizations where upper(name) = 'ATLAS NEGOCE SARL' limit 1`;

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter|connexion/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function owner(page: Page) {
  if (!page.url().includes("127.0.0.1:3000") || page.url().includes("/login")) await login(page, OWNER.email);
}

export function orgId() {
  return psql(ORG_SQL);
}

export async function run(page: Page, module: string, operation: string, fn: () => Promise<{ verdict: Verdict; detail: string; priority?: Finding["priority"]; steps?: string }>) {
  try {
    const result = await fn();
    let screenshot: string | undefined;
    if (result.verdict !== "OK") screenshot = await shot(page, `op-${slug(module)}-${slug(operation)}.png`);
    record({ module, operation, screenshot, ...result });
    return result.verdict;
  } catch (error) {
    const screenshot = await shot(page, `op-${slug(module)}-${slug(operation)}.png`).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    record({ module, operation, verdict: "bug", priority: "P1", detail: detail.slice(0, 400), screenshot, steps: page.url() });
    return "bug" as const;
  }
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function pickParty(page: Page, query: string, placeholder: RegExp) {
  const box = page.getByPlaceholder(placeholder).first();
  await box.click();
  await box.fill(query);
  const option = page.getByRole("option", { name: new RegExp(query, "i") }).first();
  if (await option.count()) {
    await option.click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(query, "i") }).first().click();
}

export async function addCommercialLine(page: Page, line: { description: string; qty: string; price: string; vat: string; discount?: string }) {
  const free = page.locator("select").filter({ has: page.locator("option", { hasText: "Ligne libre" }) }).first();
  if (await free.count()) await free.selectOption("free");
  const field = (label: string) => page.getByText(label, { exact: true }).first().locator("xpath=following::input[1]");
  await field("Description").fill(line.description);
  const priceLabel = (await page.getByText("Prix unitaire HT", { exact: true }).count()) ? "Prix unitaire HT" : "Prix HT";
  await field(priceLabel).fill(line.price);
  const qtyLabel = (await page.getByText("Quantite", { exact: true }).count()) ? "Quantite" : "Quantité";
  await field(qtyLabel).fill(line.qty);
  if (line.discount != null) {
    const label = (await page.getByText("Remise %", { exact: true }).count()) ? "Remise %" : "Remise";
    await field(label).fill(line.discount);
  }
  const tva = page.getByText("TVA", { exact: true }).first().locator("xpath=following::select[1]");
  const option = tva.locator("option", { hasText: line.vat }).first();
  if (await option.count()) await tva.selectOption((await option.getAttribute("value")) ?? "");
  await page.getByRole("button", { name: /ajouter la ligne|^ajouter$/i }).first().click();
  await page.getByRole("cell", { name: line.description }).first().waitFor({ timeout: 8_000 }).catch(() => undefined);
}

export async function fillMoney(page: Page, name: string, amount: string) {
  const hidden = page.locator(`input[name="${name}"]`);
  const visible = hidden.locator("xpath=preceding::input[not(@type='hidden')][1]");
  await visible.click();
  await visible.fill(amount);
  await visible.blur();
}

export async function clickButton(page: Page, name: string | RegExp) {
  const button = page.getByRole("button", { name }).first();
  await button.click();
  await page.waitForTimeout(1200);
}

export function money(sql: string) {
  const rows = psqlJson<Array<Record<string, string>>>(sql);
  return rows[0] ?? null;
}

export { OWNER, PASSWORD, USERS, psql, psqlJson };
