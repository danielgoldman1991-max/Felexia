/* eslint-disable @typescript-eslint/no-require-imports -- actual domain modules, isolated data. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
let assertions=0;const results=[];
function check(value,label){assert(value,label);assertions++;results.push(label);}
function load(file,mocks={}){const loaded={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:file})(id=>{if(id in mocks)return mocks[id];throw Error('Unexpected dependency '+id);},loaded,loaded.exports);return loaded.exports;}
const forecast=load('src/lib/treasury/treasury-forecast.ts');
function client(failure=null){return {from(table){const q={select(){return q;},eq(){return q;},is(){return q;},in(){return q;},gt(){return q;},gte(){return q;},lte(){return q;},not(){return q;},then(resolve,reject){if(failure===table)return Promise.resolve({data:null,error:{message:'Synthetic provider outage'}}).then(resolve,reject);const rows={treasury_accounts:[{id:'bank',name:'Bank',current_balance:1000,status:'active'}],customer_invoices:[{id:'customer-invoice',invoice_number:'FAC-TEST',status:'validated',invoice_date:'2026-10-02',due_date:null,remaining_amount:100,currency:'MAD',customer:{name:'Synthetic customer'}}],supplier_invoices:[{id:'supplier-invoice',invoice_number:'FF-TEST',supplier_invoice_number:'F-TEST',status:'validated',invoice_date:'2026-10-02',due_date:'2026-11-02',remaining_amount:50,currency:'MAD',supplier:{name:'Synthetic supplier'}}],treasury_forecast_items:[{id:'forecast',item_type:'manual',direction:'outflow',label:'Synthetic rent',forecast_date:'2026-11-03',amount:25,probability:100,status:'planned'}]};if(!(table in rows))throw Error('Unexpected table '+table);return Promise.resolve({data:rows[table],error:null}).then(resolve,reject);}};return q;}};}
(async()=>{
  const originalTZ=process.env.TZ;
  try{
    for(const timezone of ['UTC','Africa/Casablanca','America/New_York']){
      process.env.TZ=timezone;
      for(const [date,days,expected] of [['2026-11-01',1,'2026-11-02'],['2026-12-31',1,'2027-01-01'],['2028-02-28',1,'2028-02-29'],['2026-10-02',30,'2026-11-01'],['2026-03-08',1,'2026-03-09'],['2026-03-09',-1,'2026-03-08']])check(forecast.addDays(date,days)===expected,timezone+' calendar arithmetic '+date+' '+days);
      const result=await forecast.getTreasuryForecast(client(),'organization',{from:'2026-11-01',to:'2026-11-03'});
      check(result.daily.map(d=>d.date).join(',')==='2026-11-01,2026-11-02,2026-11-03',timezone+' exact inclusive calendar days');
      check(result.inflows[0].dueDate==='2026-11-01'&&result.hypothesis.invoiceWithoutDueDateCount===1,timezone+' missing due date falls back to invoice plus30 days');
      check(result.daily.map(d=>d.closingBalance).join(',')==='1100,1050,1025',timezone+' inflows and outflows land on their exact dates');
      check(result.closingForecastBalance===1025&&result.totalExpectedInflows===100&&result.totalExpectedOutflows===75,timezone+' forecast balance reconciles with expected cash flows');
    }
  }finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
  await assert.rejects(()=>forecast.getTreasuryForecast(client('treasury_accounts'),'organization',{from:'2026-11-01',to:'2026-11-03'}),/charger les soldes/);check(true,'Account read outage cannot appear as zero opening balance');
  check(forecast.computeWeightedAmount(100,50,'inflow','prudent')===35,'Prudent scenario weighs uncertain inflows');
  check(forecast.computeWeightedAmount(100,50,'outflow','prudent')===100,'Prudent scenario retains all expected outflows');
  check(forecast.computeWeightedAmount(100,50,'inflow','optimistic')===100,'Optimistic inflows use full expected amount');
  const sales=load('src/lib/sales-calculations.ts');
  const line=sales.calculateSalesLine({quantity:2,unit_price_ht:100,discount_rate:10,tax_rate:20});check(line.subtotal_ht===180&&line.tax_amount===36&&line.total_ttc===216,'Quote/order discount and VAT independently reconcile');
  const totals=sales.calculateSalesTotals([line,line]);check(totals.subtotal_ht===360&&totals.tax_total===72&&totals.total_ttc===432,'Commercial totals sum rounded lines');
  check(sales.isIndivisibleUnit({unit_name:'U'})&&!sales.isIndivisibleUnit({unit_name:'kg'}),'Units distinguish indivisible products');
  const mapping=load('src/lib/tax/dgi-vat-mapping.ts');
  const declaration=mapping.buildDeclarationLines({salesBreakdowns:[{taxRate:20,baseHtMad:180,vatAmountMad:36},{taxRate:0,baseHtMad:50,vatAmountMad:0}],collectedVatMad:36,deductibleVatMad:20,vatDueMad:16,creditCarryForwardMad:0});
  check(declaration.find(l=>l.code==='010').amountMad===230&&declaration.find(l=>l.code==='060').amountMad===180,'Preparatory VAT separates turnover and taxable base');
  check(declaration.find(l=>l.code==='080T').amountMad===36&&declaration.find(l=>l.code==='200').amountMad===16,'Preparatory VAT net amount agrees with source totals');
  const data={batchId:'QA-ONLY',generatedAt:'2026-11-01T12:00:00Z',schemaVersion:'felexia-prep-1.0',sourceSnapshotHash:'test',organization:{id:'organization',name:'Synthetic <Company> & "Co"',legalName:'Synthetic',ifNumber:'IF-TEST',ice:'ICE-TEST',currency:'MAD',address:'Synthetic street',city:'Test',countryCode:'MA'},period:{startDate:'2026-11-01',endDate:'2026-11-30',frequency:'monthly',regime:'debit'},declarationLines:declaration,salesDocuments:[{id:'invoice',documentType:'INVOICE',invoiceNumber:'FAC-TEST',issueDate:'2026-11-01',customerId:'customer',customerName:'Synthetic; "Customer"',customerIf:'IF-TEST',customerIce:'ICE-TEST',currencySource:'MAD',taxBreakdown:[{taxRate:20,baseHtMad:180,vatAmountMad:36,totalTtcMad:216}],totalTtcMad:216,status:'validated',accountingStatus:'posted'}],purchaseDocuments:[],summary:{taxableTurnoverMad:180,collectedVatMad:36,deductibleVatMad:20,vatDueMad:16,creditCarryForwardMad:0,salesCount:1,purchaseCount:0,blockingErrorsCount:0,warningsCount:0},validationIssues:[]};
  const xml=load('src/lib/tax/dgi-vat-xml.ts').generateDgiVatPreparatoryXml(data);
  check(xml.includes('&lt;Company&gt; &amp; &quot;Co&quot;')&&!xml.includes('<Company>'),'VAT XML safely escapes organization text');
  check(xml.includes('216.00')&&xml.includes('36.00'),'VAT XML preserves source amounts with two decimals');
  check(/prepar|PREPAR|Prepar/.test(xml),'VAT XML retains preparatory status');
  const csv=load('src/lib/tax/dgi-vat-csv.ts').generateDgiVatCsv(data);check(csv.startsWith('\uFEFFSECTION;')&&csv.includes('"Synthetic; ""Customer"""'),'CSV preserves Unicode and quotes delimiter-bearing names');
  check(csv.includes('non homologué officiel'),'CSV does not claim official fiscal approval');
  const issues=load('src/lib/tax/dgi-vat-validation.ts',{'@/lib/tax/dgi-vat-mapping':mapping}).validateDgiVatExport({...data,organization:{...data.organization,ifNumber:null,ice:null}});
  check(issues.some(i=>i.code==='ORG_IF_MISSING'&&i.severity==='blocking')&&issues.some(i=>i.code==='ORG_ICE_MISSING'&&i.severity==='blocking'),'Missing company identifiers block VAT preparation');
  fs.writeFileSync(path.join(__dirname,'domain-fixtures.json'),JSON.stringify({passed:true,assertions,results,scope:'Actual TS calculation/export modules with controlled API rows; sample fiscal data, no network or filing. Forecast executed under UTC, Africa/Casablanca and America/New_York.'},null,2)+'\n');console.log(JSON.stringify({passed:true,assertions}));
})().catch(e=>{console.error(e);process.exitCode=1;});
