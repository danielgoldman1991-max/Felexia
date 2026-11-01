/* eslint-disable @typescript-eslint/no-require-imports -- isolated real-action fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
let assertions = 0;
const results = [];
const check = (value, name) => { assert(value, name); assertions++; results.push(name); };
function load(file, mocks={}) {
  const loaded = { exports:{} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`,{filename:file})(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected dependency '+name);},loaded,loaded.exports);
  return loaded.exports;
}
const engine = load('src/lib/hr/payroll-engine.ts');
const rates = {cnss_enabled:true,amo_enabled:true,ir_enabled:true,cnss_employee_rate:4,cnss_employer_rate:10,amo_employee_rate:2,amo_employer_rate:3,cnss_monthly_ceiling:6000,ir_brackets:[{from:0,to:null,rate:10,deduction:100}]};
let scenario, writes, invalidations;
const employees = [{id:'employee-a',full_name:'Synthetic A',base_salary:10000},{id:'employee-b',full_name:'Synthetic B',base_salary:20000}];
function reset(options={}) { scenario={period:{id:'period',status:'draft',year:2026,month:11},employees,settings:rates,payslips:[],...options}; writes=[];invalidations=[]; }
function from(table) {
  let operation='read',values,filters=[],returning=false;
  const query={select(){returning=true;return query;},eq(k,v){filters.push([k,v]);return query;},is(k,v){filters.push([k,v]);return query;},in(k,v){filters.push([k,v]);return query;},upsert(v){operation='upsert';values=v;return query;},insert(v){operation='insert';values=v;return query;},update(v){operation='update';values=v;return query;},async maybeSingle(){return run(true);},then(resolve,reject){return Promise.resolve(run(false)).then(resolve,reject);}};
  function run(single) {
    for(const [key,value] of filters)if(key==='organization_id')assert.equal(value,'organization');
    if(operation==='read') {
      if(scenario.readError===table)return {data:null,error:{message:'synthetic provider failure'}};
      if(table==='hr_payroll_periods')return {data:scenario.period,error:null};
      if(table==='hr_employees') {check(filters.some(([k,v])=>k==='archived_at'&&v===null),'Archived employees excluded at query boundary');return {data:scenario.employees,error:null};}
      if(table==='hr_settings')return {data:scenario.settings,error:null};
      if(table==='hr_payslips')return {data:scenario.payslips,error:null};
      throw Error('Unexpected read '+table);
    }
    writes.push({table,operation,values:structuredClone(values)});
    if(table==='hr_payslips') {
      if(scenario.batchError)return {data:null,error:{message:'synthetic batch rejected'}};
      assert(Array.isArray(values),'Payroll is saved with a single batch statement');
      return {data:null,error:null};
    }
    if(table==='hr_payroll_periods') {
      if(scenario.periodError)return {data:null,error:{message:'synthetic period update rejected'}};
      if(scenario.race)return {data:null,error:null};
      if(operation==='update') {check(filters.some(([k,v])=>k==='status'&&v.join(',')==='draft,calculated'),'Period update rechecks editable status');assert(returning);}
      return {data:single?{id:'period'}:[{id:'period'}],error:null};
    }
    throw Error('Unexpected write '+table);
  }
  return query;
}
const actions=load('src/lib/hr/actions.ts',{
  'next/navigation':{redirect(target){throw Error('REDIRECT:'+target);}},'next/cache':{revalidatePath(target){invalidations.push(target);}},
  '@/lib/hr/access':{requireWritableHrWorkspace:async()=>({organization:{id:'organization'},userId:'owner'})},
  '@/lib/supabase/server':{createClient:async()=>({from})},'@/lib/hr/payroll-engine':engine,'@/lib/hr/validation':load('src/lib/hr/validation.ts'),'@/lib/pro-transaction-errors':load('src/lib/pro-transaction-errors.ts'),'@/lib/hr/reference-data':{ensureHrReferenceData:async()=>{}},
});
(async()=>{
  for(const [salary,expectedNet,expectedCost]of [[10000,8704,10900],[20000,17524,21200]]) {
    const result=engine.calculatePayslip({id:'synthetic',base_salary:salary},rates);
    check(result.netToPay===expectedNet,'Independent synthetic net '+salary);
    check(result.employerCost===expectedCost,'Independent employer cost '+salary);
    check(result.calculationDetails.schemaStatus==='preparatory'&&!result.calculationDetails.officialConformityClaim,'Engine preserves preparatory scope '+salary);
  }
  const warnings=engine.calculatePayslip({id:'x',base_salary:1000},{...rates,cnss_employee_rate:null,amo_employee_rate:null,ir_brackets:[]});
  check(warnings.warnings.length===3,'Standalone preview signals missing settings; persistence now refuses in SQL106');
  for(const [month,year]of [[0,2026],[13,2026],[1.5,2026],[1,1999],[1,2201]]){reset();const form=new FormData();form.set('month',String(month));form.set('year',String(year));await assert.rejects(()=>actions.createHrPayrollPeriodAction(form),/mois et une année/);check(writes.length===0,'Invalid month/year refuses before insertion '+month+'/'+year);}
  const form=new FormData();form.set('month','11');form.set('year','2026');reset({readError:'hr_payroll_periods'});await assert.rejects(()=>actions.createHrPayrollPeriodAction(form),/vérifier la période/);check(writes.length===0,'Failed existing-period read cannot create duplicate');
  const output=path.join(root,'training/launch-fixes/20261101/pro-transactions/payroll-engine.json');
  fs.writeFileSync(output,JSON.stringify({passed:true,assertions,results,scope:'Actual standalone engine and period creation actions. Atomic persistence is tested separately by verify-actions.cjs and SQL105/106; no legal-rate validation, env or network.'},null,2)+'\n');
  console.log(JSON.stringify({passed:true,assertions,output}));
  require('../../launch-fixes/20261101/pro-transactions/verify-actions.cjs');
})().catch(e=>{console.error(e);process.exitCode=1;});
