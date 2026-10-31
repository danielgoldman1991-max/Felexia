/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS read-only operations entry point. */
// Read-only deployment preflight. Outputs counts, never customer identities.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require('@next/env').loadEnvConfig(root);
const {createClient}=require('@supabase/supabase-js');
if(!process.argv.includes('--read-only'))throw new Error('Explicit --read-only required');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function all(table,select){let rows=[];for(;;){const r=await db.from(table).select(select).order('id').range(rows.length,rows.length+499);if(r.error)throw new Error('Read failed: '+table+' '+r.error.code);if(!r.data.length)return rows;rows.push(...r.data);}}
function duplicateCount(rows,key){const map=new Map();for(const row of rows){const k=key(row);if(k)map.set(k,(map.get(k)||0)+1);}return [...map.values()].filter(x=>x>1).length;}
(async()=>{
 const [entries,lines,invoices,accounts,subscriptions]=await Promise.all([
   all('accounting_entries','id,organization_id,source_document_type,source_document_id,status,total_debit,total_credit'),
   all('accounting_entry_lines','id,entry_id,debit,credit'),
   all('supplier_invoices','id,organization_id,supplier_id,supplier_invoice_number,status,archived_at'),
   all('treasury_accounts','id,currency,status,archived_at'),
   all('organization_subscriptions','id,status,plan_code,trial_end,trial_ends_at,current_period_end'),
 ]);
 const byEntry=new Map();for(const line of lines){const x=byEntry.get(line.entry_id)||{count:0,debit:0,credit:0};x.count++;x.debit+=Number(line.debit||0);x.credit+=Number(line.credit||0);byEntry.set(line.entry_id,x);}
 const posted=entries.filter(e=>e.status==='posted');
 const result={date:new Date().toISOString(),scope:'Read-only preflight aggregate counts; no business changes',businessWrites:0,
   accountingEntryCount:entries.length,
   duplicateAccountingSourceGroups:duplicateCount(entries.filter(e=>e.status!=='cancelled'),e=>e.source_document_type&&e.source_document_id?[e.organization_id,e.source_document_type,e.source_document_id].join('|'):null),
   postedEntriesWithoutLines:posted.filter(e=>!(byEntry.get(e.id)?.count)).length,
   postedEntriesWithUnbalancedLines:posted.filter(e=>{const x=byEntry.get(e.id);return x&&Math.abs(x.debit-x.credit)>0.005}).length,
   postedHeaderLineTotalMismatches:posted.filter(e=>{const x=byEntry.get(e.id);return x&&(Math.abs(x.debit-Number(e.total_debit||0))>0.005||Math.abs(x.credit-Number(e.total_credit||0))>0.005)}).length,
   duplicateActiveSupplierReferences:duplicateCount(invoices.filter(i=>i.status!=='cancelled'&&!i.archived_at),i=>i.supplier_invoice_number?[i.organization_id,i.supplier_id,i.supplier_invoice_number.trim().toLowerCase()].join('|'):null),
   existingNonMadTreasuryAccounts:accounts.filter(a=>a.currency&&a.currency!=='MAD').length,
   activeSubscriptionsMissingEnd:subscriptions.filter(s=>s.status==='active'&&!s.current_period_end).length,
   subscriptionCount:subscriptions.length};
 fs.mkdirSync(path.join(root,'training/essential-fixes/20261031'),{recursive:true});fs.writeFileSync(path.join(root,'training/essential-fixes/20261031/deployment-preflight.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(error=>{console.error(String(error.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]'));process.exitCode=1;});
