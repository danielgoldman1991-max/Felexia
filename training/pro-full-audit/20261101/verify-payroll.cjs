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
let scenario, writes, invalidations, savedPayslips;
const employees = [{id:'employee-a',full_name:'Synthetic A',base_salary:10000},{id:'employee-b',full_name:'Synthetic B',base_salary:20000}];
function reset(options={}) { scenario={period:{id:'period',status:'draft',year:2026,month:11},employees,settings:rates,payslips:[],...options}; writes=[];invalidations=[];savedPayslips=[]; }
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
      savedPayslips=structuredClone(values);
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
  '@/lib/supabase/server':{createClient:async()=>({from})},'@/lib/hr/payroll-engine':engine,'@/lib/hr/reference-data':{ensureHrReferenceData:async()=>{}},
});
async function rejected(options,pattern,label){reset(options);await assert.rejects(()=>actions.calculateHrPayrollPeriodAction('period'),pattern);check(writes.length===0,label+' refuses before any write');check(invalidations.length===0,label+' never advertises success');}
(async()=>{
  reset();await actions.calculateHrPayrollPeriodAction('period');
  check(writes.filter(w=>w.table==='hr_payslips').length===1&&savedPayslips.length===2,'Two real payroll calculations saved in one batch');
  check(savedPayslips[0].net_to_pay===8704&&savedPayslips[1].net_to_pay===17524,'Configurable sample rates give independently calculated net pay');
  const period=writes.find(w=>w.table==='hr_payroll_periods').values;
  check(period.total_gross===30000&&period.total_net===26228&&period.total_employer_cost===32100&&period.employees_count===2,'Period totals agree with both real calculated payslips');
  check(savedPayslips.every(p=>p.calculation_details.schemaStatus==='preparatory'&&!p.calculation_details.officialConformityClaim),'Payroll remains explicitly preparatory');
  check(invalidations.length===1,'Successful payroll refreshes its detail once');
  for(const table of ['hr_payroll_periods','hr_employees','hr_settings','hr_payslips'])await rejected({readError:table},/charger toutes/,'Read error '+table);
  for(const status of ['validated','paid','archived'])await rejected({period:{id:'period',status}},/ne peut pas être recalculée/,'Finalized period '+status);
  for(const status of ['validated','paid'])await rejected({payslips:[{employee_id:'employee-a',status}]},/bulletins finalisés/,'Finalized payslip '+status);
  await rejected({payslips:[{employee_id:'departed',status:'calculated'}]},/salariés sortis/,'Departed employee is not silently omitted from totals');
  await rejected({employees:[{id:'employee-a',base_salary:-1}]},/salaire de base/,'Negative salary');
  await rejected({employees:[{id:'employee-a',base_salary:Infinity}]},/salaire de base/,'Nonfinite salary');
  reset({batchError:true});await assert.rejects(()=>actions.calculateHrPayrollPeriodAction('period'),/bulletins n’ont pas pu/);check(writes.length===1&&savedPayslips.length===0&&invalidations.length===0,'Failed batch cannot finalize period or overwrite partial employee list');
  reset({periodError:true});await assert.rejects(()=>actions.calculateHrPayrollPeriodAction('period'),/période n’a pas pu être finalisée/);check(savedPayslips.length===2&&invalidations.length===0,'Final request failure is explicit; batch may remain and is never presented as finalized');
  reset({race:true});await assert.rejects(()=>actions.calculateHrPayrollPeriodAction('period'),/période n’a pas pu être finalisée/);check(invalidations.length===0,'Concurrent finalization does not return a false success');
  for(const [month,year] of [[0,2026],[13,2026],[1.5,2026],[1,1999],[1,2201]]) {reset();const form=new FormData();form.set('month',String(month));form.set('year',String(year));await assert.rejects(()=>actions.createHrPayrollPeriodAction(form),/mois et une année/);check(writes.length===0,'Invalid month/year rejected before insertion '+month+'/'+year);}
  const form=new FormData();form.set('month','11');form.set('year','2026');reset({readError:'hr_payroll_periods'});await assert.rejects(()=>actions.createHrPayrollPeriodAction(form),/vérifier la période/);check(writes.length===0,'Existing-period read failure cannot create a duplicate period');
  const warnings=engine.calculatePayslip({id:'x',base_salary:1000},{...rates,cnss_employee_rate:null,amo_employee_rate:null,ir_brackets:[]});
  check(warnings.warnings.length===3,'Missing social rates and IR bracket are explicitly signaled');
  const report={passed:true,assertions,results,scope:'Actual payroll TypeScript engine and actions; configurable synthetic rates and controlled Supabase failures; no legal rate validation, network or production',knownLimitation:'Payslip batch and final period update remain two requests. A final update failure or concurrent state change is now reported, but a database RPC is needed to make both writes transactional.'};
  fs.writeFileSync(path.join(__dirname,'payroll-fixtures.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,assertions}));
})().catch(e=>{console.error(e);process.exitCode=1;});
