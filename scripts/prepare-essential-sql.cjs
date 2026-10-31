/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS release packager. */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const releases=[
 ['098_essential_finance_integrity.sql','526cd8a8832d2f9ba45b47ef9eba17c7ffae1ffdc9ae5d35d2b6a5a8eaca9b0e','integrite_098_active'],
 ['099_essential_subscription_access.sql','6871dc1e5105aedc9cf67d35e960789a9cc5d6145bc6ac2a11b2169bdaafcd07','abonnement_099_actif'],
 ['100_essential_credit_note_corrections.sql','055de20ddff830ce9e1981f0f85f6cbeba1e1e810fd482f9f0562f475346c199','avoirs_100_actifs'],
 ['101_essential_supplier_credit_notes.sql','83c5096d29ecc9bee73080cb63a5b5580133e8e4fb001d7cdeb2fc45e25d870b','avoirs_fournisseurs_101_actifs'],
];
const bodies=[];const checks=[];
for(const [file,expected,alias] of releases){
 const raw=fs.readFileSync(path.join(root,'supabase/migrations',file));
 const hash=createHash('sha256').update(raw).digest('hex');
 if(hash!==expected)throw new Error('Migration changed after validation: '+file);
 const source=raw.toString('utf8').replaceAll('\r\n','\n');
 if((source.match(/^begin;$/gim)||[]).length!==1 || (source.match(/^commit;$/gim)||[]).length!==1)throw new Error('Unexpected transaction structure: '+file);
 const [core,tail]=source.replace(/^begin;$/im,'').split(/^commit;$/im);
 const match=tail.trim().match(new RegExp('^select\\s+([\\s\\S]+)\\s+as\\s+'+alias+';\\s*$','i'));
 if(!match)throw new Error('Verification changed: '+file);
 bodies.push('-- '+file+'\n-- SHA256 '+hash+'\n'+core.trim());
 checks.push('('+match[1]+') as '+alias);
}
const output='-- Felexia Pro Essentiel: migrations 098 to 101, validated release.\n-- Execute this complete file in the Felexia Supabase SQL Editor.\n-- One transaction: an error rolls back the complete batch. Existing document\n-- numbers, amounts, memberships and account currencies are not rewritten.\nbegin;\nset local lock_timeout = \'15s\';\nset local statement_timeout = \'180s\';\n\n'+bodies.join('\n\n')+'\n\ncommit;\n\nselect '+checks.join(',\n  ')+';\n';
const destination=path.join(root,'supabase/essential-launch-098-101.sql');fs.writeFileSync(destination,output);
const report={date:new Date().toISOString(),file:'supabase/essential-launch-098-101.sql',sha256:createHash('sha256').update(output).digest('hex'),bytes:Buffer.byteLength(output),transactions:1,migrations:releases.map(([file,sha256,indicator])=>({file,sha256,indicator}))};
fs.writeFileSync(path.join(root,'training/essential-fixes/20261031/sql-release.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
