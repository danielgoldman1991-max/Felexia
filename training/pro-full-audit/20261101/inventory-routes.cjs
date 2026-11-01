/* eslint-disable @typescript-eslint/no-require-imports -- read-only source inventory. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const modules = { vente:'Ventes', achats:'Achats', facturation:'Facturation', stock:'Stock', tiers:'Tiers', articles:'Articles', tresorerie:'Trésorerie', comptabilite:'Comptabilité et TVA', documents:'GED', agenda:'Agenda', outils:'Outils', rapports:'Rapports', rh:'RH', parametres:'Paramètres', dashboard:'Dashboard', bienvenue:'Guide', onboarding:'Onboarding', auth:'Authentification', login:'Authentification' };
const rows = [];
for (const file of walk(path.join(root, 'src/app')).filter(f => /(?:page\.tsx|route\.ts)$/.test(f))) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const route = '/' + path.relative(path.join(root, 'src/app'), path.dirname(file)).replaceAll('\\', '/');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [], tags = [], hrefs = [], actions = [], methods = [];
  function visit(n) {
    if (ts.isImportDeclaration(n)) imports.push({ from:n.moduleSpecifier.text, names:n.importClause?.namedBindings?.elements?.map(e=>e.name.text) ?? [] });
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const attrs = Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast), a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : a.initializer?.getText(ast)]));
      tags.push({tag:n.tagName.getText(ast),...attrs});
      for(const key of ['href','newHref','action']) if(attrs[key]) (key==='action'?actions:hrefs).push(attrs[key]);
    }
    if(ts.isFunctionDeclaration(n) && ['GET','POST','PUT','PATCH','DELETE'].includes(n.name?.text)) methods.push(n.name.text);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  let state = 'Implémentation présente';
  let reason = 'Page et composants métier présents ; voir preuves de tests séparées.';
  const placeholder = tags.find(t=>t.tag==='PlaceholderPage');
  if (placeholder || route==='/rapports') { state='Écran réservé'; reason=placeholder?.description ?? 'Rapports avancés à connecter ; aucune analyse interactive fournie.'; }
  else if (!tags.length && /redirect\(/.test(source)) { state='Redirection'; reason='Alias de compatibilité ou étape redirigée.'; }
  else if (tags.some(t=>t.tag==='HrSectionPage') && !tags.some(t=>t.newHref)) { state='Consultation RH'; reason='Liste alimentée par la base ; pas de formulaire de création ou modification dans cet écran.'; }
  else if (route==='/rh/parametres') { state='Consultation RH'; reason='Référentiels et paramètres affichés ; aucun formulaire de réglage sur cet écran.'; }
  if (/^\/rh\/(?:paie|cnss|ir)(?:\/|$)/.test(route) && state!=='Redirection') { state='Préparatoire'; reason+=' Calculs et déclarations sociaux/fiscaux non certifiés.'; }
  if (/^\/facturation\/electronique/.test(route) || /^\/comptabilite\/tva/.test(route)) { state='Préparatoire'; reason='Workflow documentaire/TVA implémenté ; aucune transmission ou homologation officielle.'; }
  if (['/rh/onboarding','/rh/offboarding','/rh/attestations'].includes(route)) { state='Écran descriptif'; reason='Cartes statiques ; aucun formulaire de checklist ou de génération de document dans cet écran.'; }
  if (route==='/rh/contrats/[id]') { state='Écran descriptif'; reason='Affiche seulement l’identifiant de route et une notice ; aucune lecture du contrat ou formulaire de détail.'; }
  if (route==='/comptabilite/exports') { state='Écran descriptif'; reason='Six cartes de formats sans lien ou bouton de téléchargement ; utiliser les exports réels journal ou plan comptable.'; }
  if (['/factures/new','/factures/[id]'].includes(route)) { state='Maquette legacy'; reason='Ancien écran statique sans persistance ; les vraies factures sont sous /facturation/factures.'; }
  rows.push({route:route==='/'?'/':route,kind:file.endsWith('route.ts')?'API/route':'Page',module:modules[route.split('/')[1]] ?? (route.startsWith('/api/')?'API': 'Public ou alias'),state,reason,file:relative,
    imports:imports.filter(i=>i.from.startsWith('@/lib/')||i.from.startsWith('@/components/')).map(i=>({from:i.from,names:i.names})),hrefs,actions,methods,
    print:/\/print$/.test(route),download:/\/(?:export|download|csv|xml)(?:\/|$)/.test(route)});
}
rows.sort((a,b)=>a.route.localeCompare(b.route));
const stats = {pages:rows.filter(r=>r.kind==='Page').length,routes:rows.filter(r=>r.kind!=='Page').length,states:Object.fromEntries([...new Set(rows.map(r=>r.state))].map(s=>[s,rows.filter(r=>r.state===s).length])),modules:Object.fromEntries([...new Set(rows.map(r=>r.module))].sort().map(s=>[s,rows.filter(r=>r.module===s).length]))};
fs.writeFileSync(path.join(__dirname,'route-matrix.json'), JSON.stringify({date:new Date().toISOString(),scope:'Exhaustive AST inventory of route/page source files; existence is not a successful functional/browser test',stats,rows},null,2)+'\n');
const cell = s => String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const md = ['# Matrice des routes ERP complet','',`Inventaire de ${stats.pages} pages et ${stats.routes} handlers. Une implémentation présente ne constitue pas une preuve de succès fonctionnel.`, '', '| Route | Module | État source | Preuve / limite |','|---|---|---|---|',...rows.map(r=>`| ${cell(r.route)} | ${cell(r.module)} | ${cell(r.state)} | ${cell(r.reason)} |`)];
fs.writeFileSync(path.join(__dirname,'ROUTE-MATRIX.md'),md.join('\n')+'\n');
console.log(JSON.stringify(stats));
