const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'src/app/rh/contrats/[id]/page.tsx');
const org='10000000-0000-4000-8000-000000000001', foreign='20000000-0000-4000-8000-000000000001';
const id='30000000-0000-4000-8000-000000000001', employeeId='40000000-0000-4000-8000-000000000001';
let rows, fail, denied, calls;
const checks=[];
const base={id,organization_id:org,employee_id:employeeId,contract_number:'CON-TEST-001',contract_type:'CDI',start_date:'2026-11-01',end_date:null,trial_period_end:'2027-01-31',base_salary:10000,status:'active'};
function reset(){rows={hr_contracts:[{...base}],hr_employees:[{id:employeeId,organization_id:org,full_name:'Salarié fictif',employee_number:'EMP-TEST-001'}]};fail=null;denied=false;calls=[];}
function component(props){return React.createElement('div',null,props.title,props.description,props.children,props.actions,props.value,props.status);}
function load(){
 const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const fakeRequire=(name)=>{
  if(name==='react/jsx-runtime')return require(name);
  if(name==='next/link')return{default:props=>React.createElement('a',{href:props.href},props.children)};
  if(name==='next/navigation')return{notFound(){throw new Error('NOT_FOUND');}};
  if(name==='@/lib/hr/access')return{async requireHrWorkspace(){if(denied)throw new Error('PRO_REQUIRED');return{organization:{id:org}};}};
  if(name==='@/lib/format')return{formatDate:value=>value};
  if(name==='@/lib/supabase/server')return {
   async createClient(){return {
    from(table){
     const filters={};calls.push({table,filters});
     return {
      select(){return this;},
      eq(k,v){filters[k]=v;return this;},
      async maybeSingle(){
       if(fail===table)return{data:null,error:new Error('PRIVATE_DB_FAILURE')};
       return {data:(rows[table]||[]).find(row=>Object.entries(filters).every(([k,v])=>row[k]===v))||null,error:null};
      },
     };
    },
   };},
  };
  if(name.startsWith('@/components/'))return new Proxy({}, {get(){return component;}});
  throw new Error('Unexpected dependency '+name);
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:fakeRequire,console},{filename:source});
 return module.exports.default;
}
const page=load();
async function run(){
 reset(); await assert.rejects(page({params:Promise.resolve({id:'bad-id'})}),/NOT_FOUND/);assert.equal(calls.length,0);checks.push('Invalid ID rejected before data access');
 reset();denied=true;await assert.rejects(page({params:Promise.resolve({id})}),/PRO_REQUIRED/);assert.equal(calls.length,0);checks.push('Full ERP access required before lookup');
 reset();rows.hr_contracts[0].organization_id=foreign;await assert.rejects(page({params:Promise.resolve({id})}),/NOT_FOUND/);assert.equal(calls.length,1);checks.push('Cross-company contract absent, no employee read');
 reset();fail='hr_contracts';await assert.rejects(page({params:Promise.resolve({id})}),e=>e.message.includes('contrat')&&!e.message.includes('PRIVATE_DB_FAILURE'));checks.push('Read outage gives explicit non-private error');
 reset();const html=renderToStaticMarkup(await page({params:Promise.resolve({id})}));assert(html.includes('CON-TEST-001')&&html.includes('Salarié fictif')&&html.includes('10000')&&html.includes('2026-11-01'));assert(calls.every(call=>call.filters.organization_id===org));checks.push('Real contract and employee displayed with both queries company-scoped');
 reset();rows.hr_employees[0].organization_id=foreign;const absent=renderToStaticMarkup(await page({params:Promise.resolve({id})}));assert(absent.includes('Dossier indisponible')&&!absent.includes('Salarié fictif'));checks.push('Foreign employee cannot leak through contract link');
 reset();fail='hr_employees';await assert.rejects(page({params:Promise.resolve({id})}),/dossier salarié/);checks.push('Employee outage is not presented as an empty successful record');
 fs.writeFileSync(path.join(__dirname,'contract-tests.json'),JSON.stringify({passed:true,assertions:checks.length,checks,scope:'Actual async page and React SSR with controlled workspace/SDK; no cloud data or browser layout tested.'},null,2));
 console.log(JSON.stringify({passed:true,assertions:checks.length}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
