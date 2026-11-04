/**
 * Export newsletter contacts and guide downloads for the Felexia owner.
 *
 * There is no platform-admin screen in this app. Run locally with the service role:
 *   npx tsx scripts/export-newsletter-subscribers.ts > newsletter.csv
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * The migration 125 must already be applied. This script only reads.
 */
import { createClient } from "../src/lib/supabase/service";

type Person = {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  phone: string | null;
  sector: string | null;
  source: string;
  consent: boolean;
  consent_at: string | null;
  created_at: string;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
};

type Download = { subscriber_id: string; guide_slug: string; created_at: string };

function cell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const supabase = createClient();
  const people = await supabase
    .from("newsletter_subscribers")
    .select("id, email, first_name, company, phone, sector, source, consent, consent_at, created_at, unsubscribed_at, unsubscribe_token")
    .order("created_at", { ascending: true });
  if (people.error) throw people.error;
  const downloads = await supabase
    .from("guide_downloads")
    .select("subscriber_id, guide_slug, created_at")
    .order("created_at", { ascending: true });
  if (downloads.error) throw downloads.error;
  const byPerson = new Map<string, string[]>();
  for (const row of (downloads.data ?? []) as Download[]) {
    const list = byPerson.get(row.subscriber_id) ?? [];
    list.push(`${row.guide_slug}@${row.created_at}`);
    byPerson.set(row.subscriber_id, list);
  }
  const header = ["email", "first_name", "company", "phone", "sector", "source", "newsletter_consent", "consent_at", "created_at", "unsubscribed_at", "unsubscribe_token", "guide_downloads"];
  const lines = [header.join(",")];
  for (const person of (people.data ?? []) as Person[]) {
    lines.push([
      person.email,
      person.first_name,
      person.company,
      person.phone,
      person.sector,
      person.source,
      person.consent ? "yes" : "no",
      person.consent_at,
      person.created_at,
      person.unsubscribed_at,
      person.unsubscribe_token,
      (byPerson.get(person.id) ?? []).join(" "),
    ].map(cell).join(","));
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Export failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
