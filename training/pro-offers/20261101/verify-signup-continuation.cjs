/* eslint-disable @typescript-eslint/no-require-imports -- real auth/onboarding modules with synthetic boundaries */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const ts = require(path.join(root, "node_modules/typescript"));
const target = "/parametres/abonnement?plan=pro&billing=yearly";
const org = "10000000-0000-4000-8000-000000000001";
const user = { id: "user_fixture", email: "qa@example.test", user_metadata: {} };
let state;
function reset() { state = { user, membership: null, organization: null, membershipError: null, organizationError: null,
  status: { hasOrganization: false, nextPath: "/onboarding/entreprise" },
  signupSession: true, profileOk: true, redirects: [], signup: [], oauth: [], rpc: [], trial: [], lookupStep: "lookup" }; }
class FixtureFormData { constructor(values = {}) { this.values = values; } get(key) { return this.values[key] ?? null; } }
function redirect(destination) { const error = Error("REDIRECT"); error.destination = destination; throw error; }
const supabase = {
  auth: {
    getUser: async () => ({ data: { user: state.user }, error: null }),
    signInWithPassword: async () => ({ data: { user: state.user }, error: null }),
    signOut: async () => ({ error: null }), updateUser: async () => ({ error: null }),
    signUp: async body => { state.signup.push(body); return { data: { user, session: state.signupSession ? {} : null }, error: null }; },
    signInWithOAuth: async body => { state.oauth.push(body); return { data: { url: "https://oauth.example.test" }, error: null }; },
    exchangeCodeForSession: async () => ({ data: { user: state.user }, error: null }),
  },
  from(table) {
    const query = { select() { return query; }, eq() { return query; }, limit() { return query; }, update() { return query; }, upsert() { return query; },
      maybeSingle: async () => table === "organization_members" ? { data: state.membership, error: state.membershipError }
        : table === "organizations" ? { data: state.organization, error: state.organizationError } : { data: {}, error: null },
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
    return query;
  },
  rpc: async (name, args) => { state.rpc.push({ name, args }); return { data: name === "create_organization_with_owner" ? org : true, error: null }; },
};
const element = (type, props) => ({ type, props });
const Flow = () => null;
const fixtures = {
  "next/navigation": { redirect, useRouter: () => ({ replace: destination => state.redirects.push(destination) }) },
  "next/server": { NextResponse: { redirect: url => ({ location: String(url) }) } },
  "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
  react: { useState: initial => [initial === "lookup" ? state.lookupStep : initial, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, useActionState: () => [{ error: null }, () => {}, false] },
  "lucide-react": new Proxy({}, { get: (_object, key) => key }),
  sonner: { Toaster: () => null },
  "@/lib/supabase/server": { createClient: async () => supabase },
  "@/lib/supabase/client": { createClient: () => supabase },
  "@/lib/app-url": { getAppUrl: () => "https://www.felexia.pro" },
  "@/lib/auth": { hasSupabaseConfig: () => true, getActiveWorkspace: async () => null },
  "@/lib/saas": { getUserOnboardingStatus: async () => state.status },
  "@/lib/auth/ensure-profile-from-auth-user": { ensureProfileFromAuthUser: async () => ({ ok: state.profileOk }), extractGoogleProfileData: () => ({}) },
  "@/lib/auth/recovery-session": { allowPasswordRecovery: async () => {} },
  "@/lib/env": { hasServiceRoleKey: () => false },
  "@/lib/org-defaults": { initializeOrganizationDefaults: async () => {} },
  "@/lib/accounting": { ensureAccountingBaseSetup: async () => ({ settings: {} }) },
  "@/lib/morocco-format": { isValidMoroccanPhone: () => true },
  "@/lib/organization-actions": { uploadOrganizationLogoForOrganization: async () => { throw Error("Unexpected upload"); } },
  "@/lib/ice/ice": { validateCompanyConfirmationInput: values => ({ normalized: values, errors: {} }) },
  "@/lib/subscriptions/plan-access": { startDefaultTrialAndEnableModules: async (...args) => state.trial.push(args) },
  "@/components/brand/BrandLogo": { BrandLogo: () => null },
  "@/components/onboarding/CompanyOnboardingFlow": { CompanyOnboardingFlow: Flow },
  "@/components/onboarding/CompanyLookupStep": { CompanyLookupStep: () => null },
  "@/components/ui/button": { Button: () => null },
  "@/components/ui/loading-overlay": { LoadingOverlay: () => null },
};
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const loadedModule = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(root, filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(output, { module: loadedModule, exports: loadedModule.exports, URL, FormData: FixtureFormData,
    window: { location: { origin: "https://www.felexia.pro" } }, console: { error() {}, info() {}, warn() {} },
    fetch: async () => ({ ok: true }), require: name => {
      if (fixtures[name]) return fixtures[name];
      if (name.startsWith("@/")) {
        const relative = `src/${name.slice(2)}`;
        return load(fs.existsSync(path.join(root, `${relative}.ts`)) ? `${relative}.ts` : `${relative}.tsx`);
      }
      throw Error(`Unexpected dependency ${name}`);
    } });
  cache.set(filename, loadedModule.exports); return loadedModule.exports;
}
const sanitizer = load("src/lib/auth/sanitize-internal-path.ts");
const continuation = load("src/lib/auth/onboarding-continuation.ts");
const resolver = load("src/lib/auth/resolve-authenticated-user-redirect.ts");
const login = load("src/lib/auth-actions.ts");
const signup = load("src/lib/auth-actions/signup.ts");
const createCompany = load("src/lib/actions/create-entreprise.ts");
const register = load("src/components/auth/register-admin-form.tsx");
const google = load("src/lib/auth/google-auth.ts");
const callback = load("src/app/auth/callback/route.ts");
const page = load("src/app/onboarding/entreprise/page.tsx");
const checks = [];
function ok(condition, label) { assert.equal(condition, true, label); checks.push(label); }
async function destination(run) { try { await run(); throw Error("Expected redirect"); } catch (error) { if (error.destination) return error.destination; throw error; } }
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  return null;
}
async function submitRegistration(withSession, next = target) {
  state.signupSession = withSession;
  const tree = register.RegisterAdminForm({ nextPath: next });
  await tree.props.onSubmit({ preventDefault() {}, currentTarget: { firstName: "QA", lastName: "Synthétique", email: "qa@example.test", password: "fixture-password", confirmPassword: "fixture-password" } });
}
async function main() {
  reset(); const setup = continuation.getCompanyOnboardingPath(target);
  ok(setup === `/onboarding/entreprise?next=${encodeURIComponent(target)}`, "Offer and annual cadence encoded through company setup");
  ok(continuation.getPostOnboardingPath(setup) === target, "Company setup wrapper resolves back to requested offer");
  for (const bad of [null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/\tevil.test", "/%0aevil.test", "/%invalid", "javascript:alert(1)"]) {
    ok(sanitizer.sanitizeInternalPath(bad) === "/dashboard", "Unsafe external/control/encoded path rejected");
    ok(continuation.getCompanyOnboardingPath(bad) === "/onboarding/entreprise", "Rejected redirect cannot survive in onboarding query");
  }
  for (const loop of ["/login?next=//evil.test", "/auth/callback", "/onboarding/formule", "/onboarding/entreprise?next=%2F%2Fevil.test"]) ok(continuation.getPostOnboardingPath(loop) === "/dashboard", "Auth/onboarding loop cannot become final destination");
  ok(sanitizer.sanitizeInternalPath("/a/../parametres/abonnement?plan=pro&billing=yearly") === target, "Internal dot segments normalize safely");
  for (const membership of [null, { organization_id: org }]) {
    reset(); state.membership = membership;
    ok(await resolver.resolveAuthenticatedUserRedirect({ supabase, userId: user.id, requestedNext: target }) === setup, "Missing company/onboarding preserves selected PRO offer");
  }
  reset(); state.membership = { organization_id: org }; state.organization = { id: org, onboarding_completed: true };
  ok(await resolver.resolveAuthenticatedUserRedirect({ supabase, userId: user.id, requestedNext: setup }) === target, "Existing completed company resumes nested offer destination");
  reset(); state.membershipError = { message: "fixture" };
  ok(await resolver.resolveAuthenticatedUserRedirect({ supabase, userId: user.id, requestedNext: target }) === setup, "Membership lookup error preserves continuation without creating company");
  reset(); const loginFields = new FixtureFormData({ email: "qa@example.test", password: "fixture-password", next: target });
  ok(await destination(() => login.loginAction({ error: null }, loginFields)) === setup, "Password login without company keeps offer through onboarding");
  state.status = { hasOrganization: true, nextPath: "/dashboard" };
  ok(await destination(() => login.loginAction({ error: null }, loginFields)) === target, "Password login with company resumes requested offer");
  for (const withSession of [true, false]) {
    reset(); await submitRegistration(withSession);
    const callbackUrl = new URL(state.signup[0].options.emailRedirectTo);
    ok(callbackUrl.origin === "https://www.felexia.pro" && callbackUrl.searchParams.get("next") === setup, "Email confirmation callback preserves PRO company continuation");
    ok(state.redirects[0] === (withSession ? setup : `/login?notice=confirm_email&next=${encodeURIComponent(setup)}`), "Client signup session and confirmation-required flows keep destination");
    ok(state.rpc.length === 0 && state.trial.length === 0, "Account signup cannot create a company, paid subscription or PRO trial");
  }
  reset(); await google.signInWithGoogle({ next: target, mode: "register" });
  const oauthCallback = new URL(state.oauth[0].options.redirectTo);
  ok(oauthCallback.searchParams.get("next") === target, "Google OAuth redirect retains chosen plan/cadence");
  ok((await callback.GET({ url: `https://www.felexia.pro/auth/callback?code=synthetic&next=${encodeURIComponent(target)}` })).location === `https://www.felexia.pro${setup}`, "OAuth callback without company wraps destination for setup");
  ok((await callback.GET({ url: `https://www.felexia.pro/auth/callback?code=synthetic&next=${encodeURIComponent(setup)}` })).location === `https://www.felexia.pro${setup}`, "Email confirmation callback retains nested continuation without double wrapping");
  const failure = await callback.GET({ url: `https://www.felexia.pro/auth/callback?error=access_denied&next=${encodeURIComponent(target)}` });
  ok(new URL(failure.location).searchParams.get("next") === target, "Cancelled OAuth retains offer on retry login");
  reset(); const signupFields = new FixtureFormData({ fullName: "QA Synthétique", email: "qa@example.test", password: "fixture-password", next: target });
  ok(await destination(() => signup.signUpAction({ error: null }, signupFields)) === setup, "Server signup preserves next with immediate session");
  state.signupSession = false;
  ok(new URL(await destination(() => signup.signUpAction({ error: null }, signupFields)), "https://www.felexia.pro").searchParams.get("next") === setup, "Server signup confirmation-required flow keeps next");
  reset(); const rendered = await page.default({ searchParams: Promise.resolve({ next: target }) });
  ok(find(rendered, node => node.type === Flow).props.nextPath === target, "Company page passes continuation to lookup/confirmation flow");
  state.lookupStep = "confirmation";
  const actualFlow = load("src/components/onboarding/CompanyOnboardingFlow.tsx").CompanyOnboardingFlow({ initialEmail: user.email, nextPath: target });
  ok(actualFlow.props.nextPath === target, "Lookup-to-confirmation transition keeps chosen offer");
  const confirmation = load("src/components/onboarding/CompanyConfirmationForm.tsx").CompanyConfirmationForm({ initialEmail: user.email, nextPath: target, onBack() {} });
  ok(find(confirmation, node => node.type === "input" && node.props.name === "next").props.value === target, "Confirmation form submits continuation in hidden field");
  state.user = null;
  const loginRedirect = await destination(() => page.default({ searchParams: Promise.resolve({ next: target }) }));
  ok(new URL(loginRedirect, "https://www.felexia.pro").searchParams.get("next") === setup, "Expired session during onboarding preserves continuation on login");
  reset(); const companyFields = new FixtureFormData({ raisonSociale: "SOCIETE QA", adresse: "Adresse synthétique", ville: "Rabat", emailEnt: "qa@example.test", next: target });
  ok(await destination(() => createCompany.createEntrepriseAction({ error: null }, companyFields)) === target, "Completed company creation resumes PRO annual offer");
  ok(state.trial.length === 1 && state.trial[0][0] === org, "Company creation uses only existing default Essentiel trial helper");
  reset(); companyFields.values.next = "//evil.test";
  ok((await destination(() => createCompany.createEntrepriseAction({ error: null }, companyFields))).startsWith("/dashboard?trial_started=1&company_created=1"), "Tampered hidden next falls back to normal company dashboard");
  fs.writeFileSync(path.join(__dirname, "signup-continuation-fixtures.json"), JSON.stringify({ success: true, checks: checks.length, scope: "Real auth/onboarding modules; synthetic Supabase/React/router only, no environment/network/email/company/payment", results: checks }, null, 2) + "\n");
  console.log(JSON.stringify({ success: true, checks: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
