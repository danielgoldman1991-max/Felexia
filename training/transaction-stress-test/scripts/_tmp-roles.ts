import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await c.from("roles" as any).select("name").order("name");
console.log(JSON.stringify([...new Set(data.map((r: any) => r.name))]));
