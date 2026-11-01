/* eslint-disable @typescript-eslint/no-require-imports -- Isolated commercial SSR fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../..');
const cache = new Map();
const results = [];
let firstState;
let stateIndex = 0;
function check(label, condition) { assert.ok(condition, label); results.push(label); }
function forbidden() { throw new Error('Commercial SSR cannot send, pay, mutate or use the network'); }
function load(relative) {
  let file = path.resolve(root, relative);
  if (!path.extname(file)) file = ['.ts', '.tsx'].map(ext => file + ext).find(candidate => fs.existsSync(candidate));
  if (!file || !file.startsWith(root + path.sep)) throw new Error('Unexpected fixture source');
  if (cache.has(file)) return cache.get(file);
  const moduleState = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file,
  }).outputText;
  vm.runInNewContext(code, {
    module: moduleState, exports: moduleState.exports, URL, Date, Error, process: { env: {} }, fetch: forbidden,
    console: { error() {}, warn() {} },
    require(name) {
      if (name === 'react') return { ...React, useState(initial) { return React.useState(stateIndex++ === 0 && firstState !== undefined ? firstState : initial); } };
      if (['react/jsx-runtime', 'lucide-react'].includes(name)) return require(name);
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.endsWith('.css')) return {};
      if (name === './LandingJourney') return { LandingJourney: () => null };
      if (name === '@/components/brand/BrandLogo') return { BrandLogo: () => React.createElement('span', null, 'Felexia') };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name)));
      throw new Error('Unmodeled SSR dependency: ' + name);
    },
  }, { filename: file });
  cache.set(file, moduleState.exports);
  return moduleState.exports;
}
function render(file, name, props = {}, initialState) {
  firstState = initialState; stateIndex = 0;
  return renderToStaticMarkup(React.createElement(load(file)[name], props));
}
function quoteCard(html) {
  const match = html.match(/<h3[^>]*>PRO<\/h3>/);
  assert.ok(match, 'PRO card renders');
  return html.slice(match.index, html.indexOf('</section>', match.index));
}
function noProPrice(label, html) {
  check(label + ': legacy PRO amounts absent', !/1290|12900/.test(html.replace(/[\s\u202f\u00a0]/g, '')));
  check(label + ': no public PRO checkout URL', !html.includes('plan=pro&amp;billing=') && !html.includes('Choisir PRO'));
}
function main() {
  for (const yearly of [false, true]) {
    const html = render('src/components/landing/LandingPricing.tsx', 'LandingPricing', {}, yearly);
    const card = html.match(/<article[^>]*aria-labelledby="conversion-plan-premium"[\s\S]*?<\/article>/)?.[0];
    check('Landing PRO card renders, annual=' + yearly, Boolean(card));
    check('Landing PRO says Sur devis, annual=' + yearly, card.includes('Sur devis') && card.includes('Demander un devis'));
    check('Landing PRO opens a quote draft, annual=' + yearly, card.includes('href="mailto:') && card.includes(encodeURIComponent('demande de devis')));
    check('Landing PRO shows no cadence or discounts, annual=' + yearly, !card.includes('MAD') && !card.includes('Facturé') && !card.includes('mois offerts'));
    check('ESSENTIEL public price preserved, annual=' + yearly, html.includes(`<strong>${yearly ? '2 900' : '290'}</strong>`));
    check('Public cadence explicitly applies to ESSENTIEL', html.includes('aria-label="Période de facturation ESSENTIEL"'));
    noProPrice('Landing annual=' + yearly, html);
  }
  const now = '2026-11-01T12:00:00Z';
  const states = [
    { name: 'new company, Stripe unavailable', currentSubscription: null, hasStripe: false },
    { name: 'ESSENTIEL trial', currentSubscription: { plan_code: 'essentiel', status: 'trialing', trial_ends_at: '2026-12-01' }, hasStripe: true },
    { name: 'PRO manual test access', currentSubscription: { plan_code: 'premium', status: 'trialing', trial_ends_at: '2026-12-01' }, hasStripe: false },
    { name: 'PRO historical paid subscriber', currentSubscription: { plan_code: 'premium', status: 'active', stripe_subscription_id: 'synthetic', stripe_customer_id: 'synthetic', current_period_end: '2026-12-01' }, hasStripe: true },
  ];
  for (const state of states) for (const billing of ['monthly', 'yearly']) {
    const label = state.name + ' / ' + billing;
    const html = render('src/components/settings/subscription-manage.tsx', 'SubscriptionManage', {
      ...state, organizationId: 'fixture-company', memberCount: 1, nowIso: now, selectedPlan: 'premium', initialBillingInterval: billing,
    });
    const card = quoteCard(html);
    check(label + ': quote label and CTA visible', card.includes('Sur devis') && card.includes('Demander un devis PRO'));
    check(label + ': quote request is independent of Stripe', card.includes('href="mailto:') && !card.includes('disabled=""'));
    check(label + ': company is retained in quote draft', card.includes('fixture-company'));
    check(label + ': PRO amount and cadence absent', !card.includes('MAD') && !card.includes('/ mois') && !card.includes('/ an') && !card.includes('2 mois offerts'));
    check(label + ': selected PRO banner asks for a quote', html.includes('PRO est proposé uniquement sur devis. Présentez-nous votre activité'));
    noProPrice(label, html);
    if (state.name === 'PRO manual test access') {
      check(label + ': private test access has accurate label', html.includes('Accès de test') && html.includes('Votre accès PRO de test.'));
      check(label + ': no public PRO trial promise', !html.includes('essai PRO') && !html.includes('Essai PRO'));
    }
  }
  const banner = render('src/components/dashboard/trial-started-banner.tsx', 'TrialStartedBanner', { planCode: 'premium' });
  check('PRO dashboard banner describes granted access', banner.includes('Votre accès PRO est activé.') && !banner.includes('essai PRO'));
  check('PRO dashboard banner refers to a quote', banner.includes('PRO est proposé uniquement sur devis.'));
  const essentialBanner = render('src/components/dashboard/trial-started-banner.tsx', 'TrialStartedBanner', { planCode: 'essentiel' });
  check('ESSENTIEL dashboard trial copy retained', essentialBanner.includes('Votre essai Essentiel a démarré.'));
  const proSection = render('src/components/landing/LandingPro.tsx', 'LandingPro');
  check('ERP highlight requests a quote', proSection.includes('Demander un devis PRO') && proSection.includes('href="mailto:'));
  noProPrice('ERP highlight', proSection);
  const faq = render('src/components/landing/LandingStory.tsx', 'LandingStory');
  check('FAQ describes quote process without PRO cycle', faq.includes('PRO est proposé uniquement sur devis.') && !faq.includes('choisit PRO'));
  const conditions = render('src/app/conditions/page.tsx', 'default');
  check('Terms describe quote-only PRO', conditions.includes('proposée uniquement sur devis') && conditions.includes('devis accepté'));
  noProPrice('Terms', conditions);
  const requestHref = load('src/lib/subscriptions/quote-contact.ts').getProQuoteHref({ organizationName: 'A&B', organizationId: 'fixture-company' });
  check('Quote draft encodes company details without sending', requestHref.startsWith('mailto:contact@felexia.pro?') && decodeURIComponent(requestHref).includes('Entreprise : A&B') && decodeURIComponent(requestHref).includes('Identifiant entreprise : fixture-company'));
  fs.writeFileSync(path.join(__dirname, 'commercial-ui-fixtures.json'), JSON.stringify({ success: true, assertions: results.length, scope: 'Real marketing, subscription and dashboard components rendered with React SSR; only Next Link, branding and noncommercial journey boundaries modeled; zero network or credentials', results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, assertions: results.length }));
}
try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
