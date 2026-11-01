/* Plan-only child-process guard: any env loader, SDK or network attempt fails. */
const Module = require('node:module');
const load = Module._load;
Module._load = function (id, ...rest) {
  if (id === '@next/env' || id.startsWith('@supabase/')) throw Error('PLAN_MUST_NOT_LOAD_ENV_OR_SDK');
  return load.call(this, id, ...rest);
};
globalThis.fetch = () => { throw Error('PLAN_MUST_NOT_CALL_NETWORK'); };
