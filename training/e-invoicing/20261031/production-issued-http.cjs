/* eslint-disable @typescript-eslint/no-require-imports -- Fixed authorized QA archive, read-only post-issuance verification. */
// The shared suite permits existing QA Auth password logins followed by GET/HEAD only.
if (!process.argv.includes('--ready-confirmed')) throw Error('Explicit production READY confirmation required');
process.argv.push('--issued-check', '--artifact=82a622e9-74d9-4f3d-92e9-69218b7924c0');
require('./production-http-readonly.cjs');
