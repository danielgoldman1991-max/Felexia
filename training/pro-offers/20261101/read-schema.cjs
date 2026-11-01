/* eslint-disable @typescript-eslint/no-require-imports -- Explicit read-only Node audit. */
// GET schema only; no business rows, SQL, billing or Storage mutations.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
require(path.join(root, 'node_modules/@next/env')).loadEnvConfig(root, false, { info() {}, error() {} });
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error('Supabase schema access unavailable');
  const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' } });
  if (!response.ok) throw Error(`Schema HTTP ${response.status}`);
  const schema = await response.json();
  const paths = Object.keys(schema.paths ?? {});
  const tables = paths.filter(p => !p.includes('/rpc/') && p !== '/').map(p => p.slice(1));
  const rpcs = paths.filter(p => p.startsWith('/rpc/')).map(p => p.slice(5));
  const tableExpected = ['sales_documents','sales_document_lines','purchase_documents','purchase_document_lines','stock_moves','stock_levels','warehouses','inventory_adjustments','inventory_adjustment_lines','documents','bank_statement_imports','bank_statement_lines','bank_reconciliations','treasury_forecast_items','tax_export_batches','hr_employees','hr_contracts','hr_departments','hr_positions','hr_leave_types','hr_leave_requests','hr_absences','hr_payroll_periods','hr_payslips','hr_salary_items','hr_settings','hr_advances','hr_loans','hr_documents','hr_evaluations','hr_disciplinary_actions'];
  const rpcExpected = ['record_stock_movements_atomic','save_customer_invoice_atomic','save_supplier_invoice_atomic','save_customer_credit_note_atomic','save_supplier_credit_note_atomic','save_accounting_entry_atomic','get_numbering_counters','get_commercial_document_usage','einvoice_get_capabilities'];
  const result = { date: new Date().toISOString(), scope: 'Production OpenAPI schema GET only; no business rows read or written', businessRowsRead: 0, businessWrites: 0, tables: tableExpected.map(name => ({ name, present: tables.includes(name) })), rpcs: rpcExpected.map(name => ({ name, present: rpcs.includes(name) })), stockRpc: schema.paths?.['/rpc/record_stock_movements_atomic']?.post?.parameters?.map(p => p.name) ?? [] };
  fs.writeFileSync(path.join(__dirname, 'production-schema.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
