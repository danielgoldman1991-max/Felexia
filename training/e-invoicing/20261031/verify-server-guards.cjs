/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server-boundary fixtures. */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { createActionRunner } = require('../../../scripts/essential-action-runner.cjs');
const runner = createActionRunner(() => { throw Error('No database in boundary fixtures'); }, [], { modules: {
  '@/lib/auth': { requireActiveWorkspace() { throw Error('No session access expected'); } },
  '@/lib/supabase/service': { createClient() { throw Error('No service access expected'); } },
  './xml-runtime': {},
} });
const { isEinvoiceRolloutEnabled, uuid } = runner.load('src/lib/e-invoicing/access.ts');
const { mapEinvoiceCapture, parseEinvoiceOptions } = runner.load('src/lib/e-invoicing/source.ts');
const { verifiedArtifactBytes, verifiedDatabaseArtifactBytes } = runner.load('src/lib/e-invoicing/integrity.ts');
const { fetchOfficialSource, OFFICIAL_EINVOICE_SOURCES } = runner.load('src/lib/e-invoicing/regulatory.ts');
const results = [];
const check = (name, condition) => { assert.ok(condition, name); results.push(name); };
const deny = (name, fn) => { assert.throws(fn); results.push(name); };
const id = '11111111-1111-4111-8111-111111111111';
const lineId = '22222222-2222-4222-8222-222222222222';
async function main() {
  check('Rollout is disabled by default', !isEinvoiceRolloutEnabled(id, {}));
  check('Global flag requires exact explicit true', !isEinvoiceRolloutEnabled(id, { FELEXIA_EINVOICING_ENABLED: 'TRUE' }));
  check('Tenant allowlist authorizes exact UUID only', isEinvoiceRolloutEnabled(id, { FELEXIA_EINVOICING_ORGANIZATION_IDS: ` other, ${id} ` }) && !isEinvoiceRolloutEnabled(id, { FELEXIA_EINVOICING_ORGANIZATION_IDS: id.slice(0,-1) }));
  deny('References reject traversal', () => uuid('../x'));
  deny('References reject arbitrary SQL syntax', () => uuid(id + "';drop table x;--"));
  const capture = { organization_id: id, source_id: id, source_kind: 'invoice', configuration: {}, facts: {
    seller: { name:'Seller', address:'Address', country:'المغرب' }, buyer:{name:'Buyer',address:'Address',country:'Maroc'},
    header:{number:'FAC-0001',date:'2026-10-31',currency:'MAD',subtotal_ht:'9007199254740991.01',discount_total:'0.00',tax_total:'0.00',total_ttc:'9007199254740991.01'},
    lines:[{id:lineId,product_name:'Article',description:'Détail عربي',quantity:'1.000',unit_price_ht:'9007199254740991.01',discount_rate:'0.00',tax_rate:'0.00',subtotal_ht:'9007199254740991.01',discount_amount:'0.00',tax_amount:'0.00',total_ttc:'9007199254740991.01'}],
  }};
  const input = mapEinvoiceCapture(capture);
  check('Source decimal cents are preserved without Number conversion', input.lines[0].unitPriceHt === '9007199254740991.01' && input.sourceTotals.totalTtc === '9007199254740991.01');
  check('Product name and supplemental description are both preserved', input.lines[0].description === 'Article — Détail عربي');
  check('Explicit Moroccan country spellings normalize to ISO', input.seller.countryCode === 'MA' && input.buyer.countryCode === 'MA');
  deny('Floating-point source values are refused', () => mapEinvoiceCapture({...capture,facts:{...capture.facts,header:{...capture.facts.header,total_ttc:1.1}}}));
  const form = new FormData(); form.set('buyerType','consumer'); form.set('lineMetadata', JSON.stringify([{sourceLineId:lineId,unitCode:'C62',taxCategory:'Z',exemptionReason:'Motif explicite de test'}]));
  check('Fiscal configuration controls RC requirement', parseEinvoiceOptions(form,input,{require_seller_rc:true}).requireSellerRc === true);
  form.set('lineMetadata', JSON.stringify([{sourceLineId:id,unitCode:'C62'}]));
  deny('Posted line metadata cannot target another line', () => parseEinvoiceOptions(form,input));
  form.set('lineMetadata', JSON.stringify([{sourceLineId:lineId,unitCode:'"><bad/>'}]));
  deny('Posted unit is strictly bounded', () => parseEinvoiceOptions(form,input));
  const bytes = Buffer.from('%PDF-1.4\nfixture only'); const artifact={content_base64:bytes.toString('base64'),byte_length:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  check('Archive bytes must match stored length and actual SHA256', verifiedArtifactBytes(artifact).equals(bytes));
  deny('Corrupted stored length blocks download', () => verifiedArtifactBytes({...artifact,byte_length:bytes.length+1}));
  deny('Corrupted stored hash blocks download', () => verifiedArtifactBytes({...artifact,sha256:'0'.repeat(64)}));
  deny('Oversized archive response is bounded', () => verifiedArtifactBytes({...artifact,content_base64:'a'.repeat(6_000_001)}));
  check('Worker decodes actual PostgREST bytea and rehashes the bytes', verifiedDatabaseArtifactBytes({content:'\\x'+bytes.toString('hex'),byte_length:bytes.length,sha256:artifact.sha256}).equals(bytes));
  deny('Worker refuses corrupted binary bytes despite unchanged metadata', () => verifiedDatabaseArtifactBytes({content:'\\x00',byte_length:bytes.length,sha256:artifact.sha256}));
  deny('Worker refuses ambiguous object buffer encodings', () => verifiedDatabaseArtifactBytes({content:{0:37},byte_length:1,sha256:artifact.sha256}));
  const calls=[]; const source=OFFICIAL_EINVOICE_SOURCES[0];
  const checked = await fetchOfficialSource(source, async(url,options)=>{ calls.push({url:String(url),options});return new Response('<html><style>volatile</style><script>volatile</script><body>'+ 'Publication publique '.repeat(12)+'</body></html>',{status:200,headers:{'content-type':'text/html'}}); });
  check('Official watch hashes accessible public content', checked.available === true && /^[a-f0-9]{64}$/.test(checked.fingerprint));
  check('Official watch sends no invoice, cookie, credentials or POST body', calls.length===1 && !calls[0].options.body && !calls[0].options.credentials && Object.keys(calls[0].options.headers).sort().join(',')==='Accept,User-Agent');
  await assert.rejects(fetchOfficialSource(source, async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})),/REDIRECT_DENIED/);results.push('Regulatory redirects to local or non-HTTPS hosts are denied');
  await assert.rejects(fetchOfficialSource(source, async()=>new Response('x',{status:200,headers:{'content-length':String(9*1024*1024)}})),/SIZE_LIMIT/);results.push('Regulatory response size is bounded');
  const unavailable=await fetchOfficialSource(source,async()=>new Response(null,{status:403}));check('Failed official reads are not interpreted as unchanged legal requirements',unavailable.available===false&&unavailable.fingerprint===null);
  // Exercise the real detail-service capability logic with controlled read boundaries.
  let sourceFingerprint='a'.repeat(64), configurationFingerprint='b'.repeat(64);
  const electronicDocument={id,organization_id:id,source_kind:'invoice',source_id:id,current_version_id:lineId,current_version_number:1,status:'draft',simulation_status:'not_submitted',issued_at:null};
  const preparedVersion={id:lineId,document_id:id,version_number:1,source_fingerprint:sourceFingerprint,configuration_fingerprint:configurationFingerprint,snapshot:input,created_at:'2026-10-31T12:00:00Z'};
  const tables={einvoice_versions:[preparedVersion],einvoice_artifacts:[],einvoice_validations:[{version_id:lineId,valid:true,result:{valid:true,issues:[],preparation_options:{buyerType:'consumer'}}}],einvoice_events:[]};
  const client={from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return{data:electronicDocument,error:null};}};return q;}};
  const context={client,workspace:{organization:{id},userId:id},settings:{configuration:{}},enabled:true,migrationReady:true,canWrite:true,canAdmin:true};
  const actualAccess=runner.load('src/lib/e-invoicing/access.ts');
  const serviceRunner=createActionRunner(()=>{throw Error('No live database in service fixture');},[],{modules:{
    './access':{...actualAccess,getEinvoiceContext:async()=>context},
    './source':{mapEinvoiceCapture,captureEinvoiceSource:async()=>({...capture,source_fingerprint:sourceFingerprint,configuration_fingerprint:configurationFingerprint,source_status:'validated',eligible:true})},
    './repository':{readEinvoiceRows:async(_client,table)=>tables[table]??[],DOCUMENT_FIELDS:'*',ARTIFACT_FIELDS:'id'},
    './regulatory':{}, './xml-runtime':{},
  }});
  const {getEinvoiceDetail}=serviceRunner.load('src/lib/e-invoicing/service.ts');
  let detail=await getEinvoiceDetail('invoice',id);check('A fresh valid preparation enables validation',detail.capabilities.canValidate===true);
  sourceFingerprint='c'.repeat(64);detail=await getEinvoiceDetail('invoice',id);check('Changed source facts block validation and guide a new preparation',!detail.capabilities.canValidate&&detail.capabilities.canPrepare&&detail.issues.some(issue=>issue.code==='SOURCE_CHANGED'));
  sourceFingerprint=preparedVersion.source_fingerprint;configurationFingerprint='d'.repeat(64);electronicDocument.status='validated';detail=await getEinvoiceDetail('invoice',id);check('Changed fiscal configuration blocks issuance in the actual service',!detail.capabilities.canIssue&&detail.issues.some(issue=>issue.code==='SOURCE_CHANGED'));
  configurationFingerprint=preparedVersion.configuration_fingerprint;detail=await getEinvoiceDetail('invoice',id);check('A fresh validated version enables issuance',detail.capabilities.canIssue===true);
  electronicDocument.issued_at='2026-10-31T12:01:00Z';electronicDocument.status='issued';sourceFingerprint='e'.repeat(64);detail=await getEinvoiceDetail('invoice',id);check('Issued copies remain frozen when live identity subsequently changes',!detail.capabilities.canPrepare&&!detail.issues.some(issue=>issue.code==='SOURCE_CHANGED'));
  const report={passed:true,checks:results.length,results,scope:'Actual source adapters, archive hashes, rollout and public-fetch guards; synthetic fixtures/injected HTTP only; no hosted service access'};
  writeFileSync(__dirname+'/server-guards.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
