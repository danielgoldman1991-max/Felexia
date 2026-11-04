/* eslint-disable @typescript-eslint/no-require-imports -- Isolated decision harness, no database. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const ts = require(path.join(root, "node_modules/typescript"));
const results = [];
function check(condition, label) {
  assert.ok(condition, label);
  results.push(label);
}
function compile(file, mocks) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })((id) => {
    if (!(id in mocks)) throw new Error(`Unexpected import ${id}`);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}

const catalog = compile("src/lib/auth/module-catalog.ts", {});
const { decideModuleAccess } = catalog;

check(decideModuleAccess("owner", [], "parametres", "write") === "allow", "Built-in owner always passes");
check(decideModuleAccess("admin", ["rh.read"], "paie", "write") === "allow", "Built-in admin always passes");
check(decideModuleAccess("Propriétaire", [], "ventes", "write") === "allow", "French owner name always passes");
check(decideModuleAccess("commercial", [], "ventes", "write") === "legacy", "A role without module codes keeps the legacy checks");
check(decideModuleAccess("commercial", ["users.manage"], "ventes", "write") === "legacy", "Codes outside the matrix do not start enforcement");
check(decideModuleAccess(null, [], "rh", "read") === "legacy", "A missing role name without codes stays legacy");
check(decideModuleAccess("commercial", ["ventes.write"], "ventes", "read") === "allow", "Write also grants read");
check(decideModuleAccess("commercial", ["ventes.write"], "ventes", "write") === "allow", "Ventes write is granted");
check(decideModuleAccess("commercial", ["ventes.read"], "ventes", "write") === "deny", "Read does not grant write");
check(decideModuleAccess("commercial", ["rh.read"], "paie", "write") === "deny", "Another module does not grant paie");
check(decideModuleAccess("commercial", ["ventes.read", "achats.write"], "achats", "read") === "allow", "Achats write grants achats read");
check(decideModuleAccess("commercial", ["tva.read"], "comptabilite", "read") === "deny", "TVA read does not open comptabilité");

function permissionClient(codes, options = {}) {
  return {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          if (table !== "organization_members") return { data: null, error: null };
          if (options.missingRole) return { data: null, error: null };
          return { data: { role_id: "role-1" }, error: null };
        },
        then(resolve, reject) {
          const payload = options.failed
            ? { data: null, error: { message: "unavailable" } }
            : { data: codes.map((code) => ({ permission: { code } })), error: null };
          return Promise.resolve(payload).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const permission = compile("src/lib/auth/module-permission.ts", {
  "@/lib/supabase/server": { createClient: async () => permissionClient([]) },
  "@/lib/auth/module-catalog": catalog,
  "@/lib/auth/roles": compile("src/lib/auth/roles.ts", {}),
});

const workspace = (role) => ({ userId: "user-1", organization: { id: "org-1" }, role });

(async () => {
  check(await permission.hasModulePermission(workspace("admin"), "paie", "write") === true, "Admin permission check does not depend on stored codes");
  const empty = compile("src/lib/auth/module-permission.ts", {
    "@/lib/supabase/server": { createClient: async () => permissionClient([]) },
    "@/lib/auth/module-catalog": catalog,
    "@/lib/auth/roles": compile("src/lib/auth/roles.ts", {}),
  });
  check(await empty.hasModulePermission(workspace("comptable"), "comptabilite", "write") === true, "Empty matrix falls back to the legacy role logic");
  check(await empty.modulePermissionDecision(workspace("comptable"), "comptabilite", "write") === "legacy", "Empty matrix is reported as legacy");
  const sales = compile("src/lib/auth/module-permission.ts", {
    "@/lib/supabase/server": { createClient: async () => permissionClient(["ventes.read"]) },
    "@/lib/auth/module-catalog": catalog,
    "@/lib/auth/roles": compile("src/lib/auth/roles.ts", {}),
  });
  check(await sales.hasModulePermission(workspace("commercial"), "ventes", "read") === true, "Stored ventes read is allowed");
  check(await sales.hasModulePermission(workspace("commercial"), "ventes", "write") === false, "Stored ventes read refuses a write");
  check((await sales.moduleAccessError(workspace("commercial"), "ventes", "write")).includes("Ventes"), "Write refusal names the module");
  const failed = compile("src/lib/auth/module-permission.ts", {
    "@/lib/supabase/server": { createClient: async () => permissionClient([], { failed: true }) },
    "@/lib/auth/module-catalog": catalog,
    "@/lib/auth/roles": compile("src/lib/auth/roles.ts", {}),
  });
  check(await failed.modulePermissionDecision(workspace("commercial"), "stock", "write") === "legacy", "A permission lookup failure keeps the legacy checks");
  const report = { passed: true, checks: results.length, results };
  fs.writeFileSync(path.join(__dirname, "module-access.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
