import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Rebuilds table columns from migrations and rejects references to a missing `role` column. */

const MIGRATIONS = "supabase/migrations";
const CONSTRAINT = new Set(["constraint", "primary", "unique", "foreign", "check", "exclude", "like"]);
const ALIAS_STOP = new Set(["where", "on", "using", "left", "right", "inner", "outer", "cross", "join", "full", "natural", "set", "returning", "group", "order", "limit", "as", "select", "from", "update", "and", "or", "not"]);

function strip(sql: string) {
  let out = "";
  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] === "-" && sql[index + 1] === "-") {
      const end = sql.indexOf("\n", index);
      index = end === -1 ? sql.length : end;
      out += "\n";
      continue;
    }
    if (sql[index] === "/" && sql[index + 1] === "*") {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 1;
      out += " ";
      continue;
    }
    if (sql[index] === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (sql[index] === "'") break;
        index += 1;
      }
      out += "''";
      continue;
    }
    out += sql[index];
  }
  return out;
}

function splitTop(body: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function readBody(sql: string, open: number) {
  let depth = 1;
  let index = open;
  while (index < sql.length && depth > 0) {
    if (sql[index] === "(") depth += 1;
    else if (sql[index] === ")") depth -= 1;
    index += 1;
  }
  return { body: sql.slice(open, index - 1), end: index };
}

const schema = new Map<string, Set<string>>();

function applyFile(sql: string) {
  const marker = /\b(?:create\s+table|alter\s+table)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(sql))) {
    const create = match[0].toLowerCase().startsWith("create");
    if (create) {
      const after = sql.slice(match.index + match[0].length);
      const header = /^\s*(?:if\s+not\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/i.exec(after);
      if (!header) continue;
      const open = sql.indexOf("(", match.index + match[0].length);
      const { body, end } = readBody(sql, open + 1);
      const columns = schema.get(header[1].toLowerCase()) ?? new Set<string>();
      for (const part of splitTop(body)) {
        const token = /^([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(part.trim());
        if (!token || CONSTRAINT.has(token[1].toLowerCase())) continue;
        columns.add(token[1].toLowerCase());
      }
      schema.set(header[1].toLowerCase(), columns);
      marker.lastIndex = end;
      continue;
    }
    const tail = sql.slice(match.index);
    const stop = tail.search(/;/);
    const statement = tail.slice(0, stop === -1 ? tail.length : stop);
    const tableMatch = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(statement);
    if (tableMatch) {
      const columns = schema.get(tableMatch[1].toLowerCase()) ?? new Set<string>();
      for (const added of statement.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) columns.add(added[1].toLowerCase());
      for (const dropped of statement.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) columns.delete(dropped[1].toLowerCase());
      for (const renamed of statement.matchAll(/rename\s+column\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+to\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
        columns.delete(renamed[1].toLowerCase());
        columns.add(renamed[2].toLowerCase());
      }
      schema.set(tableMatch[1].toLowerCase(), columns);
    }
    marker.lastIndex = match.index + statement.length;
  }
}

const problems: string[] = [];

function checkRoleColumn(file: string, sql: string) {
  const pattern = /\b(?:from|join|update)\s+(?:only\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
  for (const match of sql.matchAll(pattern)) {
    const table = match[1].toLowerCase();
    const columns = schema.get(table);
    if (!columns?.has("role_id") || columns.has("role")) continue;
    const end = sql.indexOf(";", match.index);
    const slice = sql.slice(match.index, end === -1 ? sql.length : end);
    const alias = match[2] && !ALIAS_STOP.has(match[2].toLowerCase()) ? match[2] : table;
    if (new RegExp(`\\b${alias}\\.role\\b`, "i").test(slice)) problems.push(`${file}: ${alias}.role n’existe pas sur ${table} (colonne réelle : role_id)`);
    const joinsRoles = /\bjoin\s+(?:public\.)?roles\b/i.test(slice);
    const rolesAlias = /\bjoin\s+(?:public\.)?roles\s+(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(slice)?.[1]?.toLowerCase();
    if (joinsRoles && rolesAlias === "role") continue;
    if (/\brole\b/i.test(slice.replace(new RegExp(`\\b${alias}\\.role_id\\b`, "gi"), " "))) {
      problems.push(`${file}: ${table} est filtré avec role, colonne absente. Joindre public.roles sur role_id.`);
    }
  }
}

function checkTypeScript(file: string, source: string) {
  const pattern = /\.from\(\s*["']([a-z_]+)["']\s*\)([\s\S]{0,600})/g;
  for (const match of source.matchAll(pattern)) {
    const columns = schema.get(match[1]);
    if (!columns?.has("role_id") || columns.has("role")) continue;
    const select = /\.select\(\s*["'`]([^"'`]*)["'`]/.exec(match[2]);
    if (select) {
      for (const column of select[1].split(",")) {
        const raw = column.trim();
        if (raw === "role") problems.push(`${file}: ${match[1]}.role n’existe pas. Utiliser role_id ou role:roles(name).`);
      }
    }
    if (/\.eq\(\s*["']role["']/.test(match[2]) || /\.in\(\s*["']role["']/.test(match[2])) problems.push(`${file}: filtre ${match[1]}.role`);
  }
}

const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
for (const name of files) applyFile(strip(readFileSync(join(MIGRATIONS, name), "utf8")));
assert.equal(schema.get("organization_members")?.has("role_id"), true);
assert.equal(schema.get("organization_members")?.has("role"), false);
assert.equal(schema.get("roles")?.has("name"), true);

for (const name of files) checkRoleColumn(name, strip(readFileSync(join(MIGRATIONS, name), "utf8")));

function walk(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") walk(path);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) checkTypeScript(path, readFileSync(path, "utf8"));
  }
}
walk("src");

const before = problems.length;
checkRoleColumn("fixture", "select 1 from public.organization_members where user_id = auth.uid() and role in ('owner', 'admin');");
assert.ok(problems.length > before, "le contrôle doit refuser organization_members.role");
problems.length = before;
checkRoleColumn("fixture-ok", "select 1 from public.organization_members member join public.roles member_role on member_role.id = member.role_id where member.status = 'active' and lower(member_role.name) in ('owner', 'admin');");
assert.equal(problems.length, before);

if (problems.length) {
  console.error([...new Set(problems)].slice(0, 40).join("\n"));
  throw new Error(`${new Set(problems).size} référence(s) à une colonne role absente`);
}
console.log("migration columns: ok");
