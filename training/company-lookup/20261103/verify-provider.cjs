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
  const matching = load('src/lib/ice/company-lookup-matching.ts', { '@/lib/ice/ice': parser });
  const provider = load('src/lib/ice/providers/managepro.ts', {
    htmlparser2: await import('htmlparser2'),
    '@/lib/ice/ice': parser,
    '@/lib/ice/company-lookup-matching': matching,
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
  check('Complete-word public matches precede prefix suggestions instead of selecting the first source card', () => {
    const result = parse(fixture('managepro-multi.html'), 'MAROC TELECOM');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.result, undefined);
    assert.equal(result.candidates.length, 4); assert.equal(result.candidateCount, 4);
    assert.equal(result.candidatesTruncated, false);
    assert.ok(result.candidates.slice(0, 3).every(company => /\bTELECOM\b/.test(company.raisonSociale) && /\bMAROC\b/.test(company.raisonSociale)));
    assert.equal(result.candidates[3].raisonSociale, "STE MAROCAINE D'ETUDES DE TELECOMMUNICATIONS ET AUTRES SERVICES");
    assert.ok(result.candidates.every(company => /^\d{15}$/.test(company.ice) && company.found && company.source === 'managepro'));
  });
  const second = found.replaceAll('000035228000026', '000035228000027');
  check('Two identities with the same requested legal name remain ambiguous', () => {
    assert.equal(parse(found + second, 'X2K CONSEIL').status, 'ambiguous');
  });
  check('Duplicate cards with the same ICE are deduplicated', () => {
    assert.equal(parse(found + found, 'X2K CONSEIL').status, 'found');
  });
  check('A partial last word can supply a nearby candidate without arbitrary inner-word matching', () => {
    assert.equal(parse(found, 'X2K').status, 'found');
    assert.equal(parse(found, 'X2').status, 'invalid_input');
    const prefix = parse(found, 'X2K CON');
    assert.equal(prefix.status, 'ambiguous'); assert.equal(prefix.result, undefined);
    assert.equal(prefix.candidates.length, 1); assert.equal(prefix.candidates[0].ice, '000035228000026');
    assert.equal(parse(found, 'NSEIL').status, 'not_found');
    assert.equal(parse(found, '...').status, 'not_found');
  });
  const syntheticCard = (name, index) => found.replaceAll('X2K CONSEIL', name)
    .replaceAll('000035228000026', String(900000000000000n + BigInt(index)));
  const addioui = found.replaceAll('X2K CONSEIL', 'ADDIOUI NEGOCE')
    .replaceAll('000035228000026', '002173923000040');
  check('A prefix in the first word exposes ADDIOUI NEGOCE as one explicit suggestion, never an exact ADDI identity', () => {
    const result = parse(addioui, 'ADDI NEGOCE');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.result, undefined);
    assert.equal(result.candidateCount, 1); assert.equal(result.candidatesTruncated, false);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].raisonSociale, 'ADDIOUI NEGOCE');
    assert.equal(result.candidates[0].ice, '002173923000040');
    assert.equal(result.candidates[0].query, 'ADDI NEGOCE');
    assert.ok(/proche/.test(result.message));
  });
  check('Prefixes can occur in any word order while exact ADDIOUI NEGOCE remains a confirmed name', () => {
    const reversed = parse(addioui, 'NEGOCE ADDI');
    assert.equal(reversed.status, 'ambiguous'); assert.equal(reversed.result, undefined);
    assert.equal(reversed.candidates[0].raisonSociale, 'ADDIOUI NEGOCE');
    assert.equal(parse(addioui, 'ADDIOUI NEGOCE').result.ice, '002173923000040');
    assert.equal(parse(addioui, 'NEGOCE ADDIOUI').result.ice, '002173923000040');
  });
  check('Prefix suggestions require every word and at least three characters for each incomplete word', () => {
    for (const query of ['AD NEGOCE', 'ADDI NE', 'ADDI SERVICES', 'DDI NEGOCE', 'ADDINEGOCE']) {
      const result = parse(addioui, query);
      assert.equal(result.status, 'not_found'); assert.equal(result.result, undefined); assert.equal(result.candidates, undefined);
    }
    const allPrefixes = parse(addioui, 'ADD NEG');
    assert.equal(allPrefixes.status, 'ambiguous'); assert.equal(allPrefixes.candidates[0].ice, '002173923000040');
  });
  check('Complete words rank before prefixes and exact ICE never uses the nearby name', () => {
    const exactAddi = syntheticCard('ADDI NEGOCE', 51);
    const result = parse(addioui + exactAddi, 'ADDI NEGOCE');
    assert.equal(result.status, 'ambiguous');
    assert.deepEqual(Array.from(result.candidates, company => company.raisonSociale), ['ADDI NEGOCE', 'ADDIOUI NEGOCE']);
    assert.equal(parse(addioui, '002173923000040').result.raisonSociale, 'ADDIOUI NEGOCE');
    assert.equal(parse(addioui, '002173923000041').status, 'not_found');
  });
  const suggestions = [
    syntheticCard('ALPHA CONSEIL MAROC', 1),
    syntheticCard('CONSEILS MAROC', 2),
    syntheticCard('CONSEIL INTERNATIONAL', 3),
    syntheticCard('CONSEIL', 4),
    syntheticCard('BETA CONSEIL', 5),
    syntheticCard('UNRELATED COMPANY', 6),
  ];
  check('A one-word name search exposes nearby identities and ranks exact, full-word and prefix matches', () => {
    const result = parse(suggestions.join(''), 'conseil');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.result, undefined);
    assert.deepEqual(Array.from(result.candidates, company => company.raisonSociale),
      ['CONSEIL', 'CONSEIL INTERNATIONAL', 'ALPHA CONSEIL MAROC', 'BETA CONSEIL', 'CONSEILS MAROC']);
    assert.equal(result.candidateCount, 5);
    assert.ok(!result.candidates.some(company => company.raisonSociale === 'UNRELATED COMPANY'));
  });
  check('A unique exact name does not suppress other nearby identities for explicit user choice', () => {
    const result = parse(suggestions[0] + suggestions[3], 'CONSEIL');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].raisonSociale, 'CONSEIL'); assert.equal(result.result, undefined);
  });
  check('Candidate order and deduplication do not depend on upstream source order', () => {
    const left = parse(suggestions.join('') + suggestions[0], 'CONSEIL');
    const right = parse([...suggestions].reverse().join(''), 'CONSEIL');
    assert.deepEqual(Array.from(left.candidates, company => company.ice), Array.from(right.candidates, company => company.ice));
    assert.equal(new Set(left.candidates.map(company => company.ice)).size, left.candidates.length);
  });
  check('Suggestions are bounded to ten complete public identities with an honest source-card count', () => {
    const many = Array.from({ length: 14 }, (_, index) => syntheticCard(`ATLAS CONSEIL ${String(index).padStart(2, '0')}`, 20 + index));
    const result = parse(many.reverse().join(''), 'CONSEIL');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.candidates.length, 10);
    assert.equal(result.candidateCount, 14); assert.equal(result.candidatesTruncated, true);
    assert.equal(result.candidates[0].raisonSociale, 'ATLAS CONSEIL 00');
    assert.equal(result.candidates[9].raisonSociale, 'ATLAS CONSEIL 09');
    assert.ok(!JSON.stringify(result).includes('PUBLIC_FORM_FIXTURE_TOKEN'));
    assert.ok(!JSON.stringify(result).includes('<article'));
    assert.ok(result.candidates.every(company => company.adresse === null && company.identifiantFiscal === null));
  });
  check('Case, accents and punctuation are normalized for nearby suggestions', () => {
    const result = parse(syntheticCard('ÉTUDE CONSEIL', 40) + syntheticCard('AUTRE ETUDE', 41), 'étude');
    assert.equal(result.status, 'ambiguous'); assert.equal(result.candidates.length, 2);
    assert.equal(result.candidates[0].raisonSociale, 'ÉTUDE CONSEIL');
  });
  check('Even with many nearby name candidates an ICE query returns only the exact identity', () => {
    const html = suggestions.join('');
    const result = parse(html, '900000000000005');
    assert.equal(result.status, 'found'); assert.equal(result.result.raisonSociale, 'BETA CONSEIL');
    assert.equal(result.candidates, undefined);
    assert.equal(parse(html, '900000000000999').status, 'not_found');
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
  function database(results, dbError = null, expectedHash = null) {
    const state = { keys: [], writes: [], queryHash: null };
    const query = {
      select() { return query; }, eq(column, value) { state.keys.push(value); if (column === 'query_hash') state.queryHash = value; return query; },
      gt() { return query; }, async maybeSingle() { return { data: expectedHash && expectedHash !== state.queryHash ? null : { results }, error: dbError }; },
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
  await facade.saveCompanySearchCache(noWrite.client, 'key', 'CONSEIL', 'raison_sociale', parse(suggestions.join(''), 'CONSEIL'));
  check('Ambiguous results do not enter the cache', () => assert.equal(noWrite.state.writes.length, 0));
  const digest = query => crypto.createHash('sha256').update(query).digest('hex');
  const oldNameKey = digest('raison_sociale:X2K CONSEIL');
  const newNameKey = digest('name-candidates-v3:raison_sociale:X2K CONSEIL');
  db = database([{ ...iceResult.result, query: 'X2K CONSEIL' }], null, oldNameKey); providerCalls = 0;
  await facade.searchCompany(db.client, { query: 'X2K CONSEIL' });
  check('The versioned name cache bypasses old single-result entries that could hide nearby identities', () => {
    assert.equal(db.state.queryHash, newNameKey); assert.equal(providerCalls, 1);
    assert.notEqual(newNameKey, oldNameKey);
  });
  const previousNameKey = digest('name-candidates-v1:raison_sociale:X2K CONSEIL');
  db = database([{ ...iceResult.result, query: 'X2K CONSEIL' }], null, previousNameKey); providerCalls = 0;
  await facade.searchCompany(db.client, { query: 'X2K CONSEIL' });
  check('The current cache namespace cannot reuse a prior-version confirmed prefix identity', () => {
    assert.equal(db.state.queryHash, newNameKey); assert.equal(providerCalls, 1);
    assert.notEqual(newNameKey, previousNameKey);
  });
  db = database([{ ...iceResult.result, query: 'X2K CONSEIL' }], null, newNameKey); providerCalls = 0;
  const currentNameHit = await facade.searchCompany(db.client, { query: 'X2K CONSEIL' });
  check('Current-version single name hits remain reusable without contacting the source', () => {
    assert.equal(currentNameHit.cached, true); assert.equal(providerCalls, 0);
  });
  db = database([iceResult.result]);
  await facade.searchCompany(db.client, { query: '000035228000026' });
  check('ICE cache keys retain their prior exact lookup namespace', () => {
    assert.equal(db.state.queryHash, digest('ice:000035228000026'));
  });
  db = database([]);
  await facade.saveCompanySearchCache(db.client, 'name-key', 'X2K CONSEIL', 'raison_sociale', iceResult);
  check('Name cache metadata avoids the historic unique ICE collision while retaining the real identity in results', () => {
    assert.equal(db.state.writes[0].ice, null);
    assert.equal(db.state.writes[0].results[0].ice, '000035228000026');
  });
  db = database([]);
  await facade.saveCompanySearchCache(db.client, 'ice-key', '000035228000026', 'ice', iceResult);
  check('Exact ICE cache metadata continues to identify its indexed ICE', () => {
    assert.equal(db.state.writes[0].ice, '000035228000026');
  });

  let currentUser = null;
  let apiCalls = [];
  let apiSearchError = false;
  let apiSearchResult = iceResult;
  let clockNow = Date.UTC(2026, 10, 3, 14);
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clockNow])); }
    static now() { return clockNow; }
  }
  const rate = load('src/lib/rate-limit.ts', {}, { Date: ClockDate });
  const route = load('src/app/api/company/search/route.ts', {
    'next/server': require('next/server'), zod: require('zod'),
    '@/lib/ice/ice': parser,
    '@/lib/company-search': { searchCompany: async (_client, input) => {
      apiCalls.push(input); if (apiSearchError) throw Error('Source boundary failure'); return apiSearchResult;
    } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser } }) } }) },
    '@/lib/rate-limit': rate,
  }, { Date: ClockDate });
  const request = value => new Request('http://localhost/api/company/search', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
  });
  const unauthorized = await route.POST(request({ query: 'X2K CONSEIL' }));
  check('Actual route rejects anonymous searches without calling the provider', () => {
    assert.equal(unauthorized.status, 401); assert.equal(apiCalls.length, 0);
    assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store');
  });
  currentUser = { id: 'fixture-normal-sequence' };
  // Another API using the generic limiter must not consume lookup's quota.
  rate.isRateLimited(currentUser.id, 1, 30_000);
  const normalQueries = ['000035228000026', ' X2K CONSEIL ', 'felexia', 'FELEXIA CONSEILS', 'FELEXIA CONSEILS'];
  const immediate = [];
  for (const query of normalQueries) immediate.push(await route.POST(request({ query })));
  check('ICE, name, FELEXIA, correction and retry are all accepted immediately for the same user', () => {
    assert.deepEqual(immediate.map(r => r.status), [200, 200, 200, 200, 200]);
    assert.equal(apiCalls.length, normalQueries.length);
    assert.deepEqual(apiCalls.map(input => input.query), normalQueries.map(query => parser.parseCompanyLookupInput(query).normalizedValue));
    immediate.forEach(r => assert.equal(r.headers.get('cache-control'), 'private, no-store'));
  });
  check('Lookup quota is namespaced separately from another route using the same user ID', () => {
    assert.equal(rate.isRateLimited(currentUser.id, 1, 30_000).allowed, false);
    assert.equal(immediate[0].status, 200);
  });
  const restOfBurst = [];
  for (let index = normalQueries.length; index < 10; index++) restOfBurst.push(await route.POST(request({ query: 'X2K CONSEIL' })));
  check('Ten valid lookups within one minute are allowed without an artificial inter-request delay', () => {
    assert.deepEqual(restOfBurst.map(r => r.status), Array(5).fill(200));
    assert.equal(apiCalls.length, 10);
  });
  const limited = await route.POST(request({ query: 'FELEXIA' }));
  const limitedBody = await limited.json();
  check('The eleventh lookup is bounded by a real rate-limited response with machine-readable expiry', () => {
    assert.equal(limited.status, 429); assert.equal(apiCalls.length, 10);
    assert.equal(limitedBody.status, 'rate_limited');
    const seconds = Number(limited.headers.get('retry-after'));
    assert.ok(seconds >= 1 && seconds <= 60);
    assert.equal(limitedBody.retryAfterSeconds, seconds);
    assert.equal(limited.headers.get('cache-control'), 'private, no-store');
  });
  currentUser = { id: 'fixture-independent-user' };
  const independent = await route.POST(request({ query: 'FELEXIA' }));
  check('One user exhausting lookup quota does not block another authenticated user', () => assert.equal(independent.status, 200));
  currentUser = { id: 'fixture-normal-sequence' };
  clockNow += 60_001;
  const resumed = await route.POST(request({ query: 'FELEXIA CONSEILS' }));
  check('The minute quota resets and admits a retry at its actual expiry', () => assert.equal(resumed.status, 200));

  currentUser = { id: 'fixture-invalid-requests' };
  const beforeInvalid = apiCalls.length;
  const invalidResponses = [];
  for (let index = 0; index < 3; index++) {
    invalidResponses.push(await route.POST(new Request('http://localhost/api/company/search', { method: 'POST', body: 'not json' })));
    for (const query of [123, 'a', '123', '   ']) invalidResponses.push(await route.POST(request({ query })));
  }
  check('Malformed JSON, schema errors, short names, invalid ICE and whitespace are rejected before the provider', () => {
    assert.deepEqual(invalidResponses.map(r => r.status), Array(15).fill(400));
    assert.equal(apiCalls.length, beforeInvalid);
    invalidResponses.forEach(r => assert.equal(r.headers.get('cache-control'), 'private, no-store'));
  });
  const afterInvalid = [];
  for (let index = 0; index < 10; index++) afterInvalid.push(await route.POST(request({ query: 'X2K CONSEIL' })));
  check('Invalid requests do not consume the user\'s ten valid lookup slots', () => {
    assert.deepEqual(afterInvalid.map(r => r.status), Array(10).fill(200));
    assert.equal(apiCalls.length, beforeInvalid + 10);
  });

  currentUser = { id: 'fixture-hour-limit' };
  const hourStart = clockNow;
  const hourResults = [];
  for (let minute = 0; minute < 6; minute++) {
    clockNow = hourStart + minute * 60_001;
    for (let index = 0; index < 10; index++) hourResults.push(await route.POST(request({ query: 'FELEXIA' })));
  }
  check('The hourly protection permits sixty valid lookups distributed across minute windows', () => {
    assert.deepEqual(hourResults.map(r => r.status), Array(60).fill(200));
  });
  clockNow = hourStart + 6 * 60_001;
  const hourly = await route.POST(request({ query: 'FELEXIA' }));
  const hourlyBody = await hourly.json();
  check('The sixty-first lookup is blocked by the hourly bound even after the minute window resets', () => {
    assert.equal(hourly.status, 429); assert.equal(hourlyBody.status, 'rate_limited');
    const seconds = Number(hourly.headers.get('retry-after'));
    assert.ok(seconds > 60 && seconds <= 3600); assert.equal(hourlyBody.retryAfterSeconds, seconds);
  });
  clockNow = hourStart + 3_600_001;
  const nextHour = await route.POST(request({ query: 'FELEXIA CONSEILS' }));
  check('The hourly bound releases a valid lookup at the next window', () => assert.equal(nextHour.status, 200));
  currentUser = { id: 'fixture-upstream-error' }; apiSearchError = true;
  const apiFailure = await route.POST(request({ query: 'X2K CONSEIL' }));
  check('Unexpected source errors return a private actionable unavailable response', () => {
    assert.equal(apiFailure.status, 502); assert.equal(apiFailure.headers.get('cache-control'), 'private, no-store');
  });
  assert.equal((await apiFailure.json()).status, 'unavailable');

  currentUser = { id: 'fixture-candidate-response' }; apiSearchError = false;
  apiSearchResult = parse(suggestions.join(''), 'CONSEIL');
  const apiSuggestions = await route.POST(request({ query: 'conseil' }));
  const apiSuggestionsBody = await apiSuggestions.json();
  check('The authenticated route preserves ordered nearby identities for explicit user selection', () => {
    assert.equal(apiSuggestions.status, 200);
    assert.equal(apiSuggestionsBody.status, 'ambiguous'); assert.equal(apiSuggestionsBody.result, undefined);
    assert.equal(apiSuggestionsBody.candidateCount, 5); assert.equal(apiSuggestionsBody.candidates.length, 5);
    assert.equal(apiSuggestionsBody.candidates[0].raisonSociale, 'CONSEIL');
    assert.ok(apiSuggestionsBody.candidates.every(company => /^\d{15}$/.test(company.ice)));
    assert.equal(apiSuggestions.headers.get('cache-control'), 'private, no-store');
  });

  // Synthetic legal records in the observed public card structure. No live
  // user company, source cookies or request credentials are included here.
  const secondaryCard = (name = 'ALPHA NEGOCE', ice = '900000000000081') => `<div class="conta">
    <div class="note activite">EN ACTIVITE</div><p class="par1"><img src="company.png">${name}</p>
    <p class="par2"><strong>ICE :</strong><input readonly class="inj" value="${ice}"></p>
    <div class="cnv"><p class="par3">SARL A ASSOCIE UNIQUE</p><p class="par4">RC 10101 RABAT</p>
    <p class="par4"><strong>Capital :</strong>100 000 DH</p><p class="par4"><strong>Cr&#xe9;ation :</strong>01/01/2020</p></div>
    <p class="par5"><strong>Activit&#xe9; :</strong>NEGOCE &amp; CONSEIL</p></div>`;
  const secondary = load('src/lib/ice/providers/marocfacture.ts', {
    htmlparser2: await import('htmlparser2'), '@/lib/ice/ice': parser,
    '@/lib/ice/company-lookup-matching': matching,
  }, {
    fetch(url, options) {
      requests.push({ url, options });
      if (!queue.length) throw Error('Unexpected secondary HTTP request');
      const response = queue.shift();
      return typeof response === 'function' ? response(url, options) : Promise.resolve(response);
    },
    setTimeout(callback, delay) { deadline = { callback, delay }; return 1; },
    clearTimeout() { clears++; },
    queueMicrotask,
  });
  const parseSecondary = secondary.parseMarocFactureResults;
  const secondaryExact = parseSecondary(secondaryCard(), '900000000000081');
  check('The secondary public card parser retains exact ICE and real structured fields without inventing an address', () => {
    assert.equal(secondaryExact.status, 'found');
    const company = secondaryExact.result;
    assert.equal(company.source, 'marocfacture'); assert.equal(company.raisonSociale, 'ALPHA NEGOCE');
    assert.equal(company.ice, '900000000000081'); assert.equal(company.rc, '10101'); assert.equal(company.villeRc, 'RABAT');
    assert.equal(company.formeJuridique, 'SARL A ASSOCIE UNIQUE'); assert.equal(company.activite, 'NEGOCE & CONSEIL');
    assert.equal(company.adresse, null); assert.equal(company.identifiantFiscal, null);
  });
  check('Secondary matching uses the shared exact ICE, name and explicit prefix suggestion rules', () => {
    assert.equal(parseSecondary(secondaryCard(), '900000000000082').status, 'not_found');
    assert.equal(parseSecondary(secondaryCard(), 'ALPHA NEGOCE').status, 'found');
    const close = parseSecondary(secondaryCard(), 'ALP NEGOCE');
    assert.equal(close.status, 'ambiguous'); assert.equal(close.result, undefined); assert.equal(close.candidates.length, 1);
    assert.equal(parseSecondary(secondaryCard(), 'LPH NEGOCE').status, 'not_found');
    assert.equal(parseSecondary(secondaryCard(), 'AL NEGOCE').status, 'not_found');
  });
  check('Missing, malformed or unrelated HTML cannot establish a secondary no-result response', () => {
    for (const html of ['', '<h1>Access denied</h1>', '<table><tr><td>900000000000081 ALPHA NEGOCE</td></tr></table>',
      secondaryCard().replace('900000000000081', '123'), secondaryCard().replace('class="inj"', 'class="unrelated"')]) {
      assert.equal(parseSecondary(html, 'ALPHA NEGOCE').status, 'unavailable');
    }
  });
  check('Secondary card text excludes script/style content and ICE must be the exact fifteen-digit attribute', () => {
    const clean = parseSecondary(secondaryCard('ALPHA <script>steal()</script><style>.bad{}</style>NEGOCE'), 'ALPHA NEGOCE');
    assert.equal(clean.result.raisonSociale, 'ALPHA NEGOCE'); assert.ok(!JSON.stringify(clean).includes('steal()'));
    assert.equal(parseSecondary(secondaryCard('ALPHA NEGOCE', 'ICE 900000000000081'), 'ALPHA NEGOCE').status, 'unavailable');
  });
  setup(htmlResponse(secondaryCard()));
  const secondaryLiveShape = await secondary.lookupCompanyOnMarocFacture('900000000000081', 4321);
  check('The secondary transport performs one published fixed POST with the remaining shared time budget', () => {
    assert.equal(secondaryLiveShape.status, 'found'); assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://ice.marocfacture.com/controller/controller.php');
    const options = requests[0].options;
    assert.equal(options.method, 'POST'); assert.equal(options.body.get('name'), '900000000000081');
    assert.equal(options.body.get('namers'), null); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(deadline.delay, 4321); assert.equal(clears, 1);
  });
  check('The secondary transport sends no incoming Felexia authentication, cookie or token', () => {
    const headers = requests[0].options.headers;
    assert.equal(headers.authorization, undefined); assert.equal(headers.cookie, undefined);
    assert.equal(headers.origin, 'https://ice.marocfacture.com'); assert.equal(headers.referer, 'https://ice.marocfacture.com/');
    assert.deepEqual(Array.from(requests[0].options.body.keys()), ['name']);
  });
  setup(htmlResponse(secondaryCard()));
  await secondary.lookupCompanyOnMarocFacture('alpha negoce', 50_000);
  check('Secondary name requests use only namers and never extend a request beyond fifteen seconds', () => {
    assert.equal(requests[0].options.body.get('namers'), 'ALPHA NEGOCE');
    assert.equal(requests[0].options.body.get('name'), null); assert.equal(deadline.delay, 15_000);
  });
  for (const [label, response] of [
    ['HTTP rejection', htmlResponse('Forbidden', 403)],
    ['non-HTML', new Response('{}', { headers: { 'content-type': 'application/json' } })],
    ['oversized declared body', htmlResponse(secondaryCard(), 200, { 'content-length': String(512 * 1024 + 1) })],
    ['oversized streamed body', htmlResponse('x'.repeat(512 * 1024 + 1))],
  ]) {
    setup(response);
    const responseBody = await secondary.lookupCompanyOnMarocFacture('ALPHA NEGOCE', 1000);
    check('Secondary ' + label + ' remains unavailable rather than not found', () => {
      assert.equal(responseBody.status, 'unavailable'); assert.equal(requests.length, 1); assert.equal(clears, 1);
    });
  }
  setup((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Error('AbortError')), { once: true });
    queueMicrotask(() => deadline.callback());
  }));
  const secondaryAborted = await secondary.lookupCompanyOnMarocFacture('ALPHA NEGOCE', 3);
  check('The secondary deadline aborts the request and releases its timer', () => {
    assert.equal(secondaryAborted.status, 'unavailable'); assert.equal(requests[0].options.signal.aborted, true); assert.equal(clears, 1);
  });
  setup();
  for (const [query, budget] of [['12', 1000], ['A'.repeat(101), 1000], ['ALPHA NEGOCE', 0], ['ALPHA NEGOCE', NaN]]) {
    await secondary.lookupCompanyOnMarocFacture(query, budget);
  }
  check('Invalid input or exhausted time budget cannot contact the secondary source', () => assert.equal(requests.length, 0));

  let lookupNow = 100_000;
  let primaryDuration = 500;
  let primaryReply;
  let secondaryReply;
  let orchestratedPrimaryCalls = 0;
  let fallbackCalls = [];
  class LookupDate extends Date { static now() { return lookupNow; } }
  const orchestrator = load('src/lib/ice/company-lookup-provider.ts', {
    '@/lib/ice/ice': parser, '@/lib/ice/company-lookup-matching': matching,
    '@/lib/ice/providers/managepro': { async lookupCompanyOnManagePro() { orchestratedPrimaryCalls++; lookupNow += primaryDuration; return primaryReply; } },
    '@/lib/ice/providers/marocfacture': { async lookupCompanyOnMarocFacture(query, budget) { fallbackCalls.push({ query, budget }); return secondaryReply; } },
  }, { Date: LookupDate });
  const runCombined = async (query, first, second, duration = 500) => {
    primaryReply = first; secondaryReply = second; primaryDuration = duration;
    fallbackCalls = []; orchestratedPrimaryCalls = 0;
    return orchestrator.lookupCompany(query);
  };
  const noMatch = { status: 'not_found', message: 'No matching identity in valid cards' };
  const sourceUnavailable = { status: 'unavailable', message: 'Unavailable source' };
  await runCombined('000035228000026', iceResult, secondaryExact);
  check('An exact primary ICE is returned without querying a second source', () => assert.equal(fallbackCalls.length, 0));
  const exactPrimaryName = parse(found, 'X2K CONSEIL');
  await runCombined('X2K CONSEIL', exactPrimaryName, secondaryExact);
  check('An exact normalized primary name is returned without a second source', () => assert.equal(fallbackCalls.length, 0));
  const fallbackIce = await runCombined('900000000000081', noMatch, secondaryExact, 1234);
  check('A missing primary ICE is resolved by the second source within the remaining total deadline', () => {
    assert.equal(fallbackIce.result.ice, '900000000000081'); assert.equal(fallbackIce.result.source, 'marocfacture');
    assert.equal(fallbackCalls.length, 1); assert.equal(fallbackCalls[0].query, '900000000000081'); assert.equal(fallbackCalls[0].budget, 13_766);
  });
  const primaryApproximate = parse(syntheticCard('ALPHABET NEGOCE', 80), 'ALP NEGOCE');
  const exactSecondaryName = parseSecondary(secondaryCard('ALP NEGOCE'), 'ALP NEGOCE');
  const merged = await runCombined('ALP NEGOCE', primaryApproximate, exactSecondaryName);
  check('A primary approximate suggestion cannot hide the exact name found by a second source', () => {
    assert.equal(fallbackCalls.length, 1); assert.equal(merged.status, 'ambiguous'); assert.equal(merged.result, undefined);
    assert.equal(merged.candidates[0].raisonSociale, 'ALP NEGOCE'); assert.equal(merged.candidates[0].source, 'marocfacture');
    assert.equal(merged.candidates[1].raisonSociale, 'ALPHABET NEGOCE'); assert.equal(merged.candidates[1].source, 'managepro');
  });
  const primaryDuplicate = { ...primaryApproximate, candidates: [{ ...primaryApproximate.candidates[0], ice: '900000000000081', rc: 'PRIMARY', adresse: 'PRIMARY ADDRESS' }] };
  const deduped = await runCombined('ALP NEGOCE', primaryDuplicate, exactSecondaryName);
  check('Merged duplicate ICEs retain one complete best-ranked source record without mixing legal fields', () => {
    assert.equal(deduped.status, 'found'); assert.equal(deduped.result.raisonSociale, 'ALP NEGOCE');
    assert.equal(deduped.result.source, 'marocfacture'); assert.equal(deduped.result.rc, '10101'); assert.equal(deduped.result.adresse, null);
  });
  const completePrimary = parse(syntheticCard('ALPHA NEGOCE', 80), 'NEGOCE');
  await runCombined('NEGOCE', completePrimary, noMatch);
  check('A primary single complete-word result still permits discovering an exact name on a second source', () => assert.equal(fallbackCalls.length, 1));
  for (const [label, first, second, expected] of [
    ['both valid no-match responses', noMatch, noMatch, 'not_found'],
    ['unavailable first source', sourceUnavailable, noMatch, 'unavailable'],
    ['unavailable second source', noMatch, sourceUnavailable, 'unavailable'],
    ['both sources unavailable', sourceUnavailable, sourceUnavailable, 'unavailable'],
  ]) {
    const outcome = await runCombined('ALPHA NEGOCE', first, second);
    check('Combined search handles ' + label + ' without a false absence', () => assert.equal(outcome.status, expected));
  }
  const preserved = await runCombined('ALP NEGOCE', primaryApproximate, sourceUnavailable);
  check('Valid primary suggestions remain available when the second source is unavailable', () => {
    assert.equal(preserved.status, 'ambiguous'); assert.equal(preserved.candidates[0].raisonSociale, 'ALPHABET NEGOCE');
  });
  const manyPrimary = parse(Array.from({ length: 20 }, (_, index) => syntheticCard(`ALPHA NEGOCE ${index}`, 100 + index)).join(''), 'NEGOCE');
  const retainedCount = await runCombined('NEGOCE', manyPrimary, noMatch);
  check('Merging does not erase a source count or truncation marker when only its retained choices are available', () => {
    assert.equal(retainedCount.candidates.length, 10); assert.equal(retainedCount.candidateCount, 20); assert.equal(retainedCount.candidatesTruncated, true);
  });
  const manySecondary = { ...manyPrimary, candidates: manyPrimary.candidates.map(company => ({ ...company, source: 'marocfacture' })) };
  const overlappingCounts = await runCombined('NEGOCE', manyPrimary, manySecondary);
  check('Overlapping source counts are not blindly added into a fictitious total', () => {
    assert.equal(overlappingCounts.candidateCount, 20); assert.equal(overlappingCounts.candidatesTruncated, true);
    assert.equal(new Set(overlappingCounts.candidates.map(company => company.ice)).size, 10);
  });
  const exhausted = await runCombined('ALPHA NEGOCE', noMatch, secondaryExact, 15_000);
  check('The shared fifteen-second budget prevents another request and never fabricates a confirmed absence', () => {
    assert.equal(fallbackCalls.length, 0); assert.equal(exhausted.status, 'unavailable');
  });
  await runCombined('12', noMatch, secondaryExact);
  check('Invalid orchestrated input cannot call either source', () => {
    assert.equal(orchestratedPrimaryCalls, 0); assert.equal(fallbackCalls.length, 0);
  });

  const result = { passed: checks.length, runtime: process.version, scope: 'real provider/parser/cache/rate-limit/API modules; mocked HTTP, auth and database; public fixtures; no live writes', checks };
  fs.writeFileSync(path.join(__dirname, 'provider-validation.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
