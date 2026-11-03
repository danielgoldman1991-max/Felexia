/* Real application modules; public HTML fixtures and controlled HTTP/DB boundaries.
 * No external request, authentication, SQL or application writes are made here.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
const checks = [];
const check = (name, assertion) => { assertion(); checks.push(name); };
const fixture = name => fs.readFileSync(path.join(__dirname, 'research', name), 'utf8');
const found = fixture('managepro-found.html');
const form = fixture('managepro-form.html');
const empty = fixture('managepro-not-found.html');
const errorPage = fixture('managepro-upstream-error.html');
let requests = [];
let queue = [];
let deadline;
let clears = 0;

function load(filename, imports = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, {
    exports: loaded.exports, module: loaded,
    require(name) {
      if (name in imports) return imports[name];
      throw Error('Unexpected import: ' + name);
    },
    URL, URLSearchParams, TextDecoder, AbortController, Response,
    console: { warn() {}, error() {} },
    ...globals,
  }, { filename });
  return loaded.exports;
}

function htmlResponse(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=UTF-8', ...headers } });
}
function anonymousPage(body = form) {
  const response = htmlResponse(body);
  response.headers.append('set-cookie', 'XSRF-TOKEN=source-csrf; Path=/; Secure; SameSite=Lax');
  response.headers.append('set-cookie', 'managepro_session=source-session; Path=/; HttpOnly; Secure');
  return response;
}
function setup(...responses) { requests = []; queue = responses; deadline = undefined; clears = 0; }

async function main() {
  const parser = load('src/lib/ice/ice.ts');
  const provider = load('src/lib/ice/providers/managepro.ts', {
    htmlparser2: await import('htmlparser2'),
    '@/lib/ice/ice': parser,
  }, {
    fetch(url, options) {
      requests.push({ url, options });
      if (!queue.length) throw Error('Unexpected extra HTTP request');
      const response = queue.shift();
      return typeof response === 'function' ? response(url, options) : Promise.resolve(response);
    },
    setTimeout(callback, delay) { deadline = { callback, delay }; return 1; },
    clearTimeout() { clears++; },
  });
  const parse = provider.parseManageProResults;
  const lookup = provider.lookupCompanyOnManagePro;

  const iceResult = parse(found, '000035228000026');
  check('Exact ICE selects the real X2K fixture', () => {
    assert.equal(iceResult.status, 'found'); assert.equal(iceResult.result.raisonSociale, 'X2K CONSEIL');
    assert.equal(iceResult.result.ice, '000035228000026'); assert.equal(iceResult.result.source, 'managepro');
  });
  check('RC and city are separated; unavailable legal fields stay null', () => {
    assert.equal(iceResult.result.rc, '108353'); assert.equal(iceResult.result.villeRc, 'Casablanca');
    assert.equal(iceResult.result.ville, 'Casablanca'); assert.equal(iceResult.result.formeJuridique, 'SARL');
    assert.equal(iceResult.result.adresse, null); assert.equal(iceResult.result.identifiantFiscal, null);
  });
  check('Name normalization supports case and surrounding whitespace', () => {
    assert.equal(parse(found, '  x2k conseil  ').result.ice, '000035228000026');
  });
  check('ICE mismatch never falls back to the first company', () => {
    assert.equal(parse(found, '000035228000027').status, 'not_found');
  });
  check('Unrelated public multi-result first card is not returned', () => {
    const result = parse(fixture('managepro-multi.html'), 'MAROC TELECOM');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.result, undefined);
  });
  const second = found.replaceAll('000035228000026', '000035228000027');
  check('Two identities with the same requested legal name remain ambiguous', () => {
    assert.equal(parse(found + second, 'X2K CONSEIL').status, 'ambiguous');
  });
  check('Duplicate cards with the same ICE are deduplicated', () => {
    assert.equal(parse(found + found, 'X2K CONSEIL').status, 'found');
  });
  check('Only complete word matches can supply a non-exact single candidate', () => {
    assert.equal(parse(found, 'X2K').status, 'found');
    assert.equal(parse(found, 'X2').status, 'invalid_input');
    assert.equal(parse(found, 'X2K CON').status, 'not_found');
  });
  check('A genuine no-result marker is distinguished from upstream errors', () => {
    assert.equal(parse(empty, 'ZZZ-FELEXIA-LOOKUP-NO-MATCH-20261103').status, 'not_found');
    assert.equal(parse(errorPage, 'X2K CONSEIL').status, 'unavailable');
    assert.equal(parse('<html><body>Source temporarily unavailable</body></html>', 'X2K CONSEIL').status, 'unavailable');
  });
  check('Malformed cards with no valid ICE are unavailable, not confirmed', () => {
    assert.equal(parse(found.replaceAll('000035228000026', '123'), 'X2K CONSEIL').status, 'unavailable');
  });
  const malicious = found.replace('>X2K CONSEIL</h3>', '>X2K <script>steal()</script><style>.hidden{}</style>CONSEIL</h3>');
  check('Script and style text cannot become a legal company name', () => {
    const r = parse(malicious, 'X2K CONSEIL'); assert.equal(r.status, 'found');
    assert.equal(r.result.raisonSociale, 'X2K CONSEIL'); assert.ok(!JSON.stringify(r).includes('steal()'));
  });
  check('HTML entities are decoded safely as plain data', () => {
    const r = parse(found.replaceAll('X2K CONSEIL', 'X2K &amp; CONSEIL'), 'X2K & CONSEIL');
    assert.equal(r.result.raisonSociale, 'X2K & CONSEIL');
  });

  setup(anonymousPage(), htmlResponse(found));
  const normal = await lookup('  x2k conseil ');
  check('Actual provider performs one GET and one POST and returns the fixture', () => {
    assert.equal(normal.status, 'found'); assert.equal(requests.length, 2);
    assert.equal(requests[0].url, 'https://www.managepro.ma/companylookup');
    assert.equal(requests[1].url, 'https://www.managepro.ma/companylookupjson');
    assert.equal(requests[1].options.method, 'POST');
  });
  check('Source session cookies remain isolated; request has no Felexia credentials', () => {
    const first = requests[0].options; const second = requests[1].options;
    assert.equal(first.headers.cookie, undefined); assert.equal(first.headers.authorization, undefined);
    assert.equal(second.headers.cookie, 'XSRF-TOKEN=source-csrf; managepro_session=source-session');
    assert.equal(second.headers.authorization, undefined);
    assert.equal(second.headers.origin, 'https://www.managepro.ma');
    assert.equal(second.headers.referer, 'https://www.managepro.ma/companylookup');
    assert.equal(second.body.get('_token'), 'PUBLIC_FORM_FIXTURE_TOKEN');
    assert.equal(second.body.get('thevalue'), 'X2K CONSEIL');
  });
  check('One 15-second deadline covers both requests and is cleaned up', () => {
    assert.equal(deadline.delay, 15000); assert.equal(clears, 1);
    assert.equal(requests[0].options.signal, requests[1].options.signal);
    requests.forEach(r => { assert.equal(r.options.redirect, 'error'); assert.equal(r.options.cache, 'no-store'); });
  });

  setup();
  const tooLong = await lookup('A'.repeat(101));
  check('The published 100-character source limit is not silently truncated', () => {
    assert.equal(tooLong.status, 'invalid_input'); assert.equal(requests.length, 0);
  });
  setup();
  const invalid = await lookup('12');
  check('Invalid input does not contact an external source', () => {
    assert.equal(invalid.status, 'invalid_input'); assert.equal(requests.length, 0);
  });
  for (const [label, response] of [
    ['GET 404', htmlResponse(errorPage, 404)],
    ['GET JSON', new Response('{}', { headers: { 'content-type': 'application/json' } })],
    ['GET oversized declared body', htmlResponse(form, 200, { 'content-length': String(512 * 1024 + 1) })],
    ['GET oversized streamed body', htmlResponse('x'.repeat(512 * 1024 + 1))],
    ['missing anonymous cookies', htmlResponse(form)],
    ['unexpected form destination', anonymousPage(form.replace('https://www.managepro.ma/companylookupjson', 'https://attacker.invalid/collect'))],
    ['malformed form destination', anonymousPage(form.replace('https://www.managepro.ma/companylookupjson', 'https://['))],
    ['missing token', anonymousPage(form.replace('name="_token"', 'name="unrelated"'))],
  ]) {
    setup(response);
    const result = await lookup('X2K CONSEIL');
    check(label + ' is unavailable and cannot send a POST', () => {
      assert.equal(result.status, 'unavailable'); assert.equal(requests.length, 1);
    });
  }
  for (const [label, response] of [
    ['POST expired session', htmlResponse(errorPage, 419)],
    ['POST JSON', new Response('{}', { headers: { 'content-type': 'application/json' } })],
    ['POST oversized body', htmlResponse('x'.repeat(512 * 1024 + 1))],
    ['POST changed markup', htmlResponse('<h1>Maintenance</h1>')],
  ]) {
    setup(anonymousPage(), response);
    const result = await lookup('X2K CONSEIL');
    check(label + ' stays unavailable rather than not found', () => {
      assert.equal(result.status, 'unavailable'); assert.equal(requests.length, 2);
    });
  }
  setup(anonymousPage(), htmlResponse(empty));
  const absent = await lookup('ZZZ-FELEXIA-LOOKUP-NO-MATCH-20261103');
  check('Full HTTP flow preserves confirmed absence', () => assert.equal(absent.status, 'not_found'));
  setup((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
    queueMicrotask(() => deadline.callback());
  }));
  const aborted = await lookup('X2K CONSEIL');
  check('Deadline abort is unavailable and the timer is cleared', () => {
    assert.equal(aborted.status, 'unavailable'); assert.equal(requests[0].options.signal.aborted, true); assert.equal(clears, 1);
  });

  let providerCalls = 0;
  const facade = load('src/lib/company-search.ts', {
    'node:crypto': crypto, '@/lib/ice/ice': parser,
    '@/lib/ice/company-lookup-provider': { lookupCompany: async () => { providerCalls++; return iceResult; } },
    '@/lib/supabase/server': { createClient() { throw Error('Must not create a client in fixture'); } },
  });
  function database(results, dbError = null) {
    const state = { keys: [], writes: [] };
    const query = {
      select() { return query; }, eq(_column, value) { state.keys.push(value); return query; },
      gt() { return query; }, async maybeSingle() { return { data: { results }, error: dbError }; },
      async upsert(value) { state.writes.push(value); return { error: null }; },
    };
    return { client: { from() { return query; } }, state };
  }
  let db = database([{ ...iceResult.result, source: 'synta-iq', query: 'MAROC TELECOM', raisonSociale: 'UNRELATED COMPANY' }]);
  providerCalls = 0;
  await facade.searchCompany(db.client, { query: 'MAROC TELECOM' });
  check('Old name cache bypasses the historical first-result fallback', () => { assert.equal(providerCalls, 1); assert.equal(db.state.writes.length, 1); });
  db = database([{ ...iceResult.result, query: 'X2K CONSEIL' }]); providerCalls = 0;
  const cached = await facade.searchCompany(db.client, { query: 'x2k conseil' });
  check('Current ManagePro name cache is reused without external HTTP', () => { assert.equal(cached.cached, true); assert.equal(providerCalls, 0); assert.equal(db.state.writes.length, 0); });
  db = database([{ ...iceResult.result, query: 'OTHER QUERY' }]); providerCalls = 0;
  await facade.searchCompany(db.client, { query: 'X2K CONSEIL' });
  check('Name cache with a different stored query is rejected', () => assert.equal(providerCalls, 1));
  db = database([{ ...iceResult.result, ice: '000035228000027' }]); providerCalls = 0;
  const mismatched = await facade.searchCompany(db.client, { query: '000035228000026' });
  check('ICE cache mismatch calls the source and returns the requested identity', () => { assert.equal(providerCalls, 1); assert.equal(mismatched.cached, undefined); assert.equal(mismatched.result.ice, '000035228000026'); });
  db = database([{ ...iceResult.result, found: false }]); providerCalls = 0;
  await facade.searchCompany(db.client, { query: '000035228000026' });
  check('A cached found:false result is never confirmed', () => assert.equal(providerCalls, 1));
  db = database([]); providerCalls = 0;
  await facade.searchCompany(db.client, { query: 'X2K CONSEIL' });
  check('An old negative cache cannot hide source recovery', () => assert.equal(providerCalls, 1));
  const noWrite = database([]);
  await facade.saveCompanySearchCache(noWrite.client, 'key', 'QUERY', 'raison_sociale', { status: 'ambiguous', message: 'Choose an ICE' });
  check('Ambiguous results do not enter the cache', () => assert.equal(noWrite.state.writes.length, 0));

  let currentUser = null;
  let apiCalls = [];
  let apiSearchError = false;
  const rate = load('src/lib/rate-limit.ts');
  const route = load('src/app/api/company/search/route.ts', {
    'next/server': require('next/server'), zod: require('zod'),
    '@/lib/company-search': { searchCompany: async (_client, input) => {
      apiCalls.push(input); if (apiSearchError) throw Error('Source boundary failure'); return iceResult;
    } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser } }) } }) },
    '@/lib/rate-limit': rate,
  });
  const request = value => new Request('http://localhost/api/company/search', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
  });
  const unauthorized = await route.POST(request({ query: 'X2K CONSEIL' }));
  check('Actual route rejects anonymous searches without calling the provider', () => {
    assert.equal(unauthorized.status, 401); assert.equal(apiCalls.length, 0);
    assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store');
  });
  currentUser = { id: 'fixture-member-one' };
  const apiFound = await route.POST(request({ query: ' X2K CONSEIL ' }));
  check('Actual route returns a private no-store authenticated result', () => {
    assert.equal(apiFound.status, 200); assert.equal(apiCalls.length, 1);
    assert.equal(apiCalls[0].query, 'X2K CONSEIL');
    assert.equal(apiFound.headers.get('cache-control'), 'private, no-store');
  });
  const limited = await route.POST(request({ query: '000035228000026' }));
  const limitedBody = await limited.json();
  check('Actual route enforces one request per 30 seconds and sends Retry-After', () => {
    assert.equal(limited.status, 429); assert.equal(apiCalls.length, 1);
    const seconds = Number(limited.headers.get('retry-after')); assert.ok(seconds >= 1 && seconds <= 30);
    assert.match(limitedBody.message, /secondes/); assert.equal(limited.headers.get('cache-control'), 'private, no-store');
  });
  currentUser = { id: 'fixture-invalid-body' };
  const badBody = await route.POST(new Request('http://localhost/api/company/search', { method: 'POST', body: 'not json' }));
  check('Malformed request JSON does not invoke company search', () => {
    assert.equal(badBody.status, 400); assert.equal(apiCalls.length, 1);
    assert.equal(badBody.headers.get('cache-control'), 'private, no-store');
  });
  currentUser = { id: 'fixture-invalid-schema' };
  const badSchema = await route.POST(request({ query: 123 }));
  check('Invalid request types are rejected before company search', () => {
    assert.equal(badSchema.status, 400); assert.equal(apiCalls.length, 1);
  });
  currentUser = { id: 'fixture-upstream-error' }; apiSearchError = true;
  const apiFailure = await route.POST(request({ query: 'X2K CONSEIL' }));
  check('Unexpected source errors return a private actionable unavailable response', () => {
    assert.equal(apiFailure.status, 502); assert.equal(apiFailure.headers.get('cache-control'), 'private, no-store');
  });
  assert.equal((await apiFailure.json()).status, 'unavailable');

  const result = { passed: checks.length, runtime: process.version, scope: 'real provider/parser/cache/rate-limit/API modules; mocked HTTP, auth and database; public fixtures; no live writes', checks };
  fs.writeFileSync(path.join(__dirname, 'provider-validation.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
