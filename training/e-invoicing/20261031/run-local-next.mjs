// Launch only an isolated loopback app. Never fall back to the real .env credentials.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("Use the supported Node22 runtime");
const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") throw new Error("Explicit dev or start mode required");
const manifestName = process.argv.find(value => value.startsWith("--manifest="))?.slice(11) || "einvoice-local-preprod-private.json";
const manifestPath = resolve("../backups", manifestName);
if (!["einvoice-local-preprod-private.json", "einvoice-operations-local-private.json"].some(name => resolve("../backups", name) === manifestPath)) throw new Error("Only named private local fixture manifests are permitted");
const fixture = JSON.parse(await readFile(manifestPath, "utf8"));
if (fixture.localOnly !== true || fixture.authSimulated !== true) throw new Error("Explicit isolated fixture manifest required");
const env = { ...process.env, ...fixture.environment };
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
  if (!env[name]) continue;
  const url = new URL(env[name]);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["55441", "55442"].includes(url.port) || env[name] !== fixture.gatewayUrl) throw new Error("Local fixture gateway required");
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Complete isolated credentials required");
for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "CRON_SECRET"]) env[name] = "";
const port = process.argv.find(value => value.startsWith("--port="))?.slice(7) || (mode === "dev" ? fixture.operations ? "3104" : "3102" : "3103");
if (!["3102", "3103", "3104"].includes(port)) throw new Error("Only named local app ports are permitted");
env.NEXT_PUBLIC_APP_URL = `http://localhost:${port}`;
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), mode, "--hostname", "localhost", "--port", port], { env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
