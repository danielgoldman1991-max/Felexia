/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS fixture runner, including VM require adapters. */
// Recette only: execute the real server functions against authenticated SDK clients.
// Only Next request/caching/navigation boundaries are supplied by this harness.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const ts = projectRequire('typescript');

class ActionRedirect extends Error {
  constructor(destination) { super('ACTION_REDIRECT'); this.destination = destination; }
}

function createActionRunner(getClient, diagnostics = [], options = {}) {
  const modules = new Map();
  function resolveSource(target) {
    for (const candidate of [target, target+'.ts', target+'.tsx', target+'.js', path.join(target,'index.ts')]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    throw new Error('Action source unavailable: '+path.relative(root,target));
  }
  function load(target) {
    const file = resolveSource(path.isAbsolute(target) ? target : path.join(root,target));
    if (!file.startsWith(root+path.sep)) throw new Error('Action source outside repository');
    if (modules.has(file)) return modules.get(file).exports;
    const loaded = { exports: {} };
    modules.set(file,loaded);
    function localRequire(id) {
      if (options.modules && Object.prototype.hasOwnProperty.call(options.modules, id)) return options.modules[id];
      if (id === '@/lib/supabase/server') return { createClient: async () => getClient() };
      if (id === 'next/headers' && options.cookies) return {
        cookies: async () => typeof options.cookies === 'function' ? options.cookies() : options.cookies,
      };
      if (id === 'next/cache') return { revalidatePath(){}, revalidateTag(){}, unstable_noStore(){} };
      if (id === 'next/navigation') return {
        redirect(destination){ throw new ActionRedirect(destination); },
        notFound(){ throw new Error('ACTION_NOT_FOUND'); },
      };
      if (id === 'server-only') return {};
      if (id === 'react') return { ...projectRequire('react'), cache: fn => fn };
      if (id.startsWith('@/')) return load(path.join(root,'src',id.slice(2)));
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file),id));
      return projectRequire(id);
    }
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
      fileName:file,
    }).outputText;
    vm.runInNewContext(code,{
      module:loaded,exports:loaded.exports,require:localRequire,process,Buffer,
      console:{log(){},info(){},warn(){},error(...args){diagnostics.push(String(args[0]).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').slice(0,200));}},
      URL,URLSearchParams,Headers,Request,Response,FormData,File,Blob,AbortSignal,
      fetch,crypto:globalThis.crypto,setTimeout,clearTimeout,TextEncoder,TextDecoder,
      __dirname:path.dirname(file),__filename:file,
    },{filename:file});
    return loaded.exports;
  }
  async function invoke(file,name,payload={},previous={success:false,error:null}) {
    const form = new FormData();
    for(const [key,value] of Object.entries(payload)) {
      if (Array.isArray(value)) form.set(key,JSON.stringify(value));
      else if(value !== undefined && value !== null) form.set(key,String(value));
    }
    try { return { result:await load(file)[name](previous,form) }; }
    catch(error) {
      if(error instanceof ActionRedirect) return {redirect:error.destination};
      throw error;
    }
  }
  return {load,invoke,ActionRedirect};
}
module.exports={createActionRunner,ActionRedirect};
