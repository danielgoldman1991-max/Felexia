/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS integration-test entry point. */
// Explicitly authorized recette. Never run against an existing customer company.
// Credentials and received email tokens stay in the private manifest outside Git.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require('@next/env').loadEnvConfig(root);
const {createClient}=require('@supabase/supabase-js');
const {createActionRunner}=require('./essential-action-runner.cjs');
const manifestPath=process.argv.find(x=>x.startsWith('--manifest='))?.slice(11);
const phase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8) || 'read';
if(!manifestPath || !process.argv.includes('--execute-qa')) throw new Error('Explicit private manifest and --execute-qa required');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !m.run?.startsWith('essential-final-')) throw new Error('Recette company marker required');
const mailbox=m.authorizedMailbox;
if(typeof mailbox!=='string' || !mailbox.includes('@'))throw new Error('Authorized test mailbox must be specified privately');
const [mailboxName,mailboxDomain]=mailbox.toLowerCase().split('@');
for(const role of ['admin','operator','viewer']) {
  const email=(m.users?.[role]?.email || '').toLowerCase();
  const prefix=mailboxName+'+recette';const suffix=role+'@'+mailboxDomain;
  if(!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length,-suffix.length)))throw new Error('Only the authorized recette aliases may be used');
}
const reportDir=path.join(root,'training/essential-fixes/20261031');fs.mkdirSync(reportDir,{recursive:true});
const report={date:new Date().toISOString(),run:m.run,phase,companyName:m.companyName,checks:[],diagnostics:[]};
function save(){fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');fs.writeFileSync(path.join(reportDir,'company-'+phase+'.json'),JSON.stringify(report,null,2)+'\n');}
function check(name,condition,observed){report.checks.push({name,passed:Boolean(condition),...(observed===undefined?{}:{observed})});if(!condition)throw new Error('QA_CHECK_FAILED: '+name);}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url || !key || key.startsWith('sb_secret_')) throw new Error('Public project configuration required');
const clients={};let actor='admin';
const runner=createActionRunner(()=>clients[actor],report.diagnostics);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
function newClient(){return createClient(url,key,options);}
async function login(role){
  actor=role;
  const client=clients[role] || newClient();clients[role]=client;
  const signed=await client.auth.signInWithPassword({email:m.users[role].email,password:m.users[role].password});
  check(role+' public authentication',!signed.error);
  m.users[role].id=signed.data.user?.id;
  return client;
}
async function read(query,name){const r=await query;check(name+' query',!r.error,r.error?.code);return r.data;}
async function workspace(){
  const w=await runner.load('src/lib/auth.ts').getActiveWorkspace();
  check(actor+' company isolation',w?.organization.id===m.organizationId && w?.organization.name===m.companyName);
  return w;
}
async function action(file,name,data,expectSuccess=true){
  const response=await runner.invoke(file,name,data);
  const success=typeof response.redirect==='string'
    ? response.redirect.startsWith('/') && !/^\/(?:login|onboarding|abonnement|parametres\/abonnement)(?:[/?#]|$)/.test(response.redirect)
    : Boolean(response.result && typeof response.result==='object' && !response.result.error && response.result.success!==false);
  check(actor+' '+name,expectSuccess?success:!success,response.result?.error ? String(response.result.error).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]'):response.redirect);
  return response;
}
const idFrom=result=>(result.redirect || '').match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] || result.result?.data?.id;
const today=new Date().toISOString().slice(0,10);
const freeLine=(description,quantity,price,tax=20)=>({id:crypto.randomUUID(),mode:'free',unit_name:'Unité',description,quantity,unit_price_ht:price,discount_rate:0,tax_rate:tax});

async function prepare(){
  clients.admin=newClient();actor='admin';
  if(!m.users.admin.id){
    const callback=new URL('/auth/callback',runner.load('src/lib/app-url.ts').getAppUrl());callback.searchParams.set('next','/onboarding/entreprise');
    const signup=await clients.admin.auth.signUp({email:m.users.admin.email,password:m.users.admin.password,options:{emailRedirectTo:callback.toString(),data:{full_name:'Recette Administrateur',first_name:'Recette',last_name:'Administrateur'}}});
    check('new subscriber registration succeeds',!signup.error && Boolean(signup.data.user));
    check('signup establishes expected auto-confirmed session',Boolean(signup.data.session));
    m.users.admin.id=signup.data.user.id;save();
  }else await login('admin');
  const profile=await runner.load('src/app/api/auth/create-profile/route.ts').POST();
  check('real registration profile API succeeds',profile.status===200);
  if(!m.organizationId){
    const created=await action('src/lib/actions/create-entreprise.ts','createEntrepriseAction',{
      raisonSociale:m.companyName,adresse:'10 rue de la Recette, entreprise fictive',ville:'Casablanca',telephone:'+212524101010',
      emailEnt:m.users.admin.email,formeJuridique:'SARL',adminFirstName:'Recette',adminLastName:'Administrateur',activite:'Recette fonctionnelle sans activité réelle',
    });
    check('company onboarding completes',Boolean(created.redirect?.startsWith('/dashboard')));
    const w=await runner.load('src/lib/auth.ts').getActiveWorkspace();check('company has expected name',w?.organization.name===m.companyName);m.organizationId=w.organization.id;save();
  }
  const w=await workspace();check('new company administrator role',['admin','owner'].includes(w.role));check('new company has usable Essentiel trial',w.subscription?.status==='trialing' && w.subscription?.planCode==='essentiel');
  const db=clients.admin;
  const journals=await read(db.from('accounting_journals').select('id,code').eq('organization_id',m.organizationId),'new company journals');
  const accounts=await read(db.from('accounting_accounts').select('id,code').eq('organization_id',m.organizationId),'new company accounts');
  const roles=await read(db.from('roles').select('id,name').eq('organization_id',m.organizationId),'new company roles');
  check('five base journals initialized',journals.length>=5);check('base accounting initialized',accounts.length>0);check('three required profiles available',['admin','operator','viewer'].every(role=>roles.some(x=>x.name===role)));
  m.journals=journals;m.roles=roles;m.accounts=accounts;save();
}

async function invite(){
  await login('admin');await workspace();
  const inviteService=runner.load('src/lib/auth/invite-user.ts');
  for(const role of ['operator','viewer']){
    if(m.users[role].invitationId)continue;
    const roleId=m.roles.find(x=>x.name===role)?.id;check(role+' tenant role exists',Boolean(roleId));
    try{
      const invited=await inviteService.inviteOrganizationUser({email:m.users[role].email,roleId,fullName:m.users[role].name});
      m.users[role].invitationId=invited.invitationId;m.users[role].id=invited.authUserId;check(role+' real invitation dispatched',Boolean(invited.invitationId));save();
    }catch(error){report.invitationFailure={role,code:error.code || 'UNKNOWN',message:String(error.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')};throw new Error('QA_INVITATION_FAILED');}
  }
  const rows=await read(clients.admin.from('invitations').select('id,status').eq('organization_id',m.organizationId),'pending invitations');
  check('two distinct invitations',new Set(rows.map(x=>x.id)).size===2);
}

async function accept(){
  for(const role of ['operator','viewer']){
    if(m.users[role].accepted)continue;
    actor=role;clients[role]=newClient();
    const receipt=m.users[role].receivedLink;
    check(role+' invitation email received',Boolean(receipt?.tokenHash));
    const verified=await clients[role].auth.verifyOtp({type:'invite',token_hash:receipt.tokenHash});
    check(role+' received email establishes matching session',!verified.error && verified.data.user?.id===m.users[role].id);
    const completed=await action('src/lib/actions/complete-invitation.ts','completeInvitationAction',{
      invitationId:m.users[role].invitationId,password:m.users[role].password,confirmPassword:m.users[role].password,fullName:m.users[role].name,
    });
    check(role+' activation completes',Boolean(completed.redirect?.startsWith('/dashboard') || completed.result?.error===null));
    const w=await workspace();check(role+' role preserved',w.role===role);m.users[role].accepted=true;delete m.users[role].receivedLink;save();
  }
  await login('admin');const members=await read(clients.admin.from('organization_members').select('user_id,status').eq('organization_id',m.organizationId).eq('status','active'),'active team');
  check('company contains exactly three active users',members.length===3);save();
}

async function resend(){
  await login('admin');await workspace();
  const route=runner.load('src/app/api/invitations/[id]/route.ts');
  for(const role of ['operator','viewer']){
    check(role+' pending test invitation exists',Boolean(m.users[role].invitationId)&&!m.users[role].accepted);
    if(m.users[role].resent)continue;
    const response=await route.PATCH(new Request('https://felexia.pro/api/invitations/'+m.users[role].invitationId,{method:'PATCH'}),{params:Promise.resolve({id:m.users[role].invitationId})});
    const body=await response.json();
    check(role+' real invitation resend',response.status===200,body.code||body.error);
    const row=await read(clients.admin.from('invitations').select('auth_user_id,status').eq('organization_id',m.organizationId).eq('id',m.users[role].invitationId).single(),'resent invitation');
    check(role+' resend preserves invited account',row.auth_user_id===m.users[role].id&&row.status==='pending');
    m.users[role].resent=true;delete m.users[role].receivedLink;save();
  }
}

async function readOnly(){
  for(const role of ['admin','operator','viewer']){await login(role);const w=await workspace();check(role+' expected role',w.role===role || (role==='admin' && w.role==='owner'));}
}

async function business(){
  await login('admin');await workspace();
  const record=m.records;
  if(!record.bankId){const r=await action('src/lib/treasury-actions.ts','createTreasuryAccount',{name:'Banque de recette MAD',code:'QA-BQ',account_type:'bank',currency:'MAD',opening_balance:0,is_default:'on'});record.bankId=idFrom(r);save();}
  check('QA treasury account identifier',Boolean(record.bankId));
  if(!record.productId){
    let products=await read(clients.admin.from('products').select('id').eq('organization_id',m.organizationId).eq('name','Service du catalogue de recette'),'existing QA catalogue service');
    if(!products.length){await action('src/lib/product-actions.ts','createProduct',{name:'Service du catalogue de recette',type:'service',sale_price_ht:100,purchase_price_ht:50,status:'active',is_sellable:'on',is_purchasable:'on'});products=await read(clients.admin.from('products').select('id').eq('organization_id',m.organizationId).eq('name','Service du catalogue de recette'),'created QA catalogue service');}
    check('one identifiable QA catalogue service',products.length===1);record.productId=products[0].id;save();
  }
  await login('operator');await workspace();
  if(!record.customerId){const r=await action('src/lib/third-party-actions.ts','createThirdParty',{name:'CLIENT RECETTE ESSENTIELLE',type_customer:'on',status:'active',country:'MA'});record.customerId=idFrom(r);save();}
  if(!record.supplierId){const r=await action('src/lib/third-party-actions.ts','createThirdParty',{name:'FOURNISSEUR RECETTE ESSENTIELLE',type_supplier:'on',status:'active',country:'MA'});record.supplierId=idFrom(r);save();}
  check('QA customer and supplier created',Boolean(record.customerId && record.supplierId));
  await action('src/lib/third-party-actions.ts','updateThirdParty',{id:record.customerId,name:'CLIENT RECETTE ESSENTIELLE',type_customer:'on',status:'active',country:'MA',city:'Casablanca',notes:'Coordonnées mises à jour pendant la recette'});
  const saleForm={customer_id:record.customerId,invoice_date:today,source_type:'manual',notes:'Recette de facturation libre',lines:[freeLine('Prestation de recette',2,100)]};
  if(!record.saleId){const r=await action('src/lib/invoice-actions.ts','createCustomerInvoice',saleForm);record.saleId=idFrom(r);save();}
  let sale=(await read(clients.operator.from('customer_invoices').select('id,invoice_number,total_ttc,status').eq('organization_id',m.organizationId).eq('id',record.saleId).single(),'created sale'));
  if(sale.status==='draft'){
    const before=sale.invoice_number;
    await action('src/lib/invoice-actions.ts','updateCustomerInvoice',{...saleForm,id:record.saleId,notes:'Brouillon corrigé par opérateur'});
    let after=await read(clients.operator.from('customer_invoices').select('invoice_number,total_ttc').eq('id',record.saleId).single(),'operator updated sale');
    check('operator edit preserves invoice number',after.invoice_number===before && before.length>0);
    await login('admin');await action('src/lib/invoice-actions.ts','updateCustomerInvoice',{...saleForm,id:record.saleId,notes:'Brouillon corrigé par administrateur'});
    after=await read(clients.admin.from('customer_invoices').select('invoice_number,total_ttc').eq('id',record.saleId).single(),'administrator updated sale');
    check('administrator edit preserves invoice number',after.invoice_number===before);
    await login('operator');await action('src/lib/invoice-actions.ts','validateCustomerInvoice',{id:record.saleId});
  }
  sale=await read(clients.operator.from('customer_invoices').select('invoice_number,total_ttc,subtotal_ht,tax_total,status,paid_amount,remaining_amount').eq('id',record.saleId).single(),'validated sale');
  check('sale HT TVA TTC are coherent',Number(sale.subtotal_ht)===200 && Number(sale.tax_total)===40 && Number(sale.total_ttc)===240);
  const purchaseForm={supplier_id:record.supplierId,supplier_invoice_number:'QA-ACHAT-001',invoice_date:today,source_type:'manual',lines:[freeLine('Achat de recette',1,100)],notes:'Recette achat fournisseur'};
  if(!record.purchaseId){const r=await action('src/lib/purchase-actions.ts','createSupplierInvoice',purchaseForm);record.purchaseId=idFrom(r);save();}
  let purchase=await read(clients.operator.from('supplier_invoices').select('id,invoice_number,total_ttc,status').eq('id',record.purchaseId).single(),'created purchase');
  if(purchase.status==='draft'){
    const before=purchase.invoice_number;
    await action('src/lib/purchase-actions.ts','updateSupplierInvoice',{...purchaseForm,id:record.purchaseId,notes:'Brouillon achat corrigé'});
    const after=await read(clients.operator.from('supplier_invoices').select('invoice_number').eq('id',record.purchaseId).single(),'updated purchase');
    check('purchase edit preserves internal number',after.invoice_number===before && before.length>0);
    await action('src/lib/purchase-actions.ts','validateSupplierInvoice',{id:record.purchaseId});
  }
  purchase=await read(clients.operator.from('supplier_invoices').select('invoice_number,total_ttc,subtotal_ht,tax_total,status').eq('id',record.purchaseId).single(),'validated purchase');
  check('purchase HT TVA TTC are coherent',Number(purchase.subtotal_ht)===100 && Number(purchase.tax_total)===20 && Number(purchase.total_ttc)===120);
  if(!record.customerPaymentIds)record.customerPaymentIds=[];
  for(const [index,amount] of [75,165].entries()){
    if(record.customerPaymentIds[index])continue;
    const r=await action('src/lib/payment-actions.ts','createCustomerPayment',{third_party_id:record.customerId,treasury_account_id:record.bankId,amount,payment_method:'bank_transfer',payment_date:today,idempotency_key:crypto.randomUUID(),allocations:[{invoice_id:record.saleId,amount}]});
    record.customerPaymentIds[index]=idFrom(r);save();
    const partial=await read(clients.operator.from('customer_invoices').select('paid_amount,remaining_amount').eq('id',record.saleId).single(),'sale after payment '+(index+1));
    check('customer payment '+(index+1)+' updates invoice balance',Number(partial.paid_amount)===(index===0?75:240) && Number(partial.remaining_amount)===(index===0?165:0));
  }
  if(!record.supplierPaymentId){const r=await action('src/lib/purchase-actions.ts','createSupplierPayment',{supplier_id:record.supplierId,treasury_account_id:record.bankId,amount:120,payment_method:'bank_transfer',payment_date:today,idempotency_key:crypto.randomUUID(),allocations:[{invoice_id:record.purchaseId,amount:120}]});record.supplierPaymentId=idFrom(r);save();}
  const paidPurchase=await read(clients.operator.from('supplier_invoices').select('paid_amount,remaining_amount').eq('id',record.purchaseId).single(),'purchase after payment');
  check('supplier payment clears purchase',Number(paidPurchase.paid_amount)===120 && Number(paidPurchase.remaining_amount)===0);
  await action('src/lib/payment-actions.ts','createCustomerPayment',{third_party_id:record.customerId,treasury_account_id:record.bankId,amount:-1,payment_method:'bank_transfer'},false);
  await action('src/lib/payment-actions.ts','createCustomerPayment',{third_party_id:record.customerId,treasury_account_id:record.bankId,amount:999,payment_method:'bank_transfer',allocations:[{invoice_id:record.saleId,amount:999}]},false);
  await login('admin');
  for(const [name,payload] of [
    ['postCustomerInvoiceToAccounting',{id:record.saleId,invoice_id:record.saleId}],
    ['postSupplierInvoiceToAccounting',{id:record.purchaseId,invoice_id:record.purchaseId}],
    ...record.customerPaymentIds.map(id=>['postCustomerPaymentToAccounting',{id,payment_id:id}]),
    ['postSupplierPaymentToAccounting',{id:record.supplierPaymentId,payment_id:record.supplierPaymentId}],
  ])await action('src/lib/accounting-actions.ts',name,payload);
  await action('src/lib/payment-actions.ts','cancelCustomerPayment',{id:record.customerPaymentIds[0]},false);
  await action('src/lib/payment-actions.ts','updateCustomerPayment',{id:record.customerPaymentIds[0],amount:76,payment_date:today},false);
  await action('src/lib/purchase-actions.ts','cancelSupplierPayment',{id:record.supplierPaymentId},false);
  const bank=await read(clients.admin.from('treasury_accounts').select('current_balance,currency').eq('id',record.bankId).single(),'bank after posted cancellation attempts');
  check('bank net equals 120 MAD',Number(bank.current_balance)===120 && bank.currency==='MAD');
  const entries=await read(clients.admin.from('accounting_entries').select('id,status,total_debit,total_credit,source_document_type,source_document_id').eq('organization_id',m.organizationId),'company posted entries');
  check('five posted source entries created exactly once',entries.filter(x=>x.status==='posted').length===5);
  check('each posted entry is balanced',entries.every(x=>Math.abs(Number(x.total_debit)-Number(x.total_credit))<0.005));
  check('posted sources are unique',new Set(entries.map(x=>x.source_document_type+':'+x.source_document_id)).size===entries.length);
  report.financial={saleTtc:240,supplierInvoiceTtc:120,bankBalance:Number(bank.current_balance),postedEntries:entries.length,totalDebit:entries.reduce((s,x)=>s+Number(x.total_debit),0),totalCredit:entries.reduce((s,x)=>s+Number(x.total_credit),0)};
  save();
}

async function boundaries(){
  const record=m.records;
  await login('operator');await workspace();
  if(!record.contactId){
    await action('src/lib/third-party-actions.ts','createThirdPartyContact',{third_party_id:record.customerId,full_name:'Contact de recette',is_primary:'on'});
    const contacts=await read(clients.operator.from('third_party_contacts').select('id').eq('third_party_id',record.customerId).eq('full_name','Contact de recette'),'created contact');record.contactId=contacts[0]?.id;save();
  }
  if(!record.addressId){
    await action('src/lib/third-party-actions.ts','createThirdPartyAddress',{third_party_id:record.customerId,label:'Siège recette',address:'10 rue fictive de recette',city:'Casablanca',country:'MA',type:'billing'});
    const addresses=await read(clients.operator.from('third_party_addresses').select('id').eq('third_party_id',record.customerId).eq('label','Siège recette'),'created address');record.addressId=addresses[0]?.id;save();
  }
  await action('src/lib/treasury-actions.ts','createTreasuryAccount',{name:'Compte opérateur interdit',currency:'MAD'},false);
  await action('src/lib/accounting-actions.ts','postCustomerInvoiceToAccounting',{id:record.saleId},false);
  const counterDenied=await clients.operator.rpc('get_numbering_counters',{p_organization_id:m.organizationId,p_period:today.slice(0,7)+'-01'});
  check('operator cannot administer numbering',Boolean(counterDenied.error));
  try { await runner.load('src/lib/auth/invite-user.ts').inviteOrganizationUser({email:m.users.viewer.email,roleId:m.roles.find(x=>x.name==='viewer').id,fullName:'Forbidden'});check('operator cannot invite users',false); }
  catch(error){check('operator cannot invite users',error.code==='FORBIDDEN');}
  await login('viewer');await workspace();
  await action('src/lib/third-party-actions.ts','createThirdParty',{name:'Création viewer interdite',type_customer:'on',status:'active'},false);
  await action('src/lib/invoice-actions.ts','createCustomerInvoice',{customer_id:record.customerId,invoice_date:today,lines:[freeLine('Interdit viewer',1,1)]},false);
  for(const [table,id,patch] of [
    ['third_party_contacts',record.contactId,{full_name:'MODIFICATION INTERDITE'}],
    ['third_party_addresses',record.addressId,{address:'MODIFICATION INTERDITE'}],
    ['customer_invoices',record.saleId,{notes:'MODIFICATION INTERDITE'}],
    ['treasury_accounts',record.bankId,{current_balance:99999}],
  ]){
    const result=await clients.viewer.from(table).update(patch).eq('organization_id',m.organizationId).eq('id',id).select('id');
    check('viewer direct write refused on '+table,Boolean(result.error || !result.data?.length));
  }
  const subscriptionBefore=await read(clients.viewer.from('organization_subscriptions').select('id,status,plan_code,current_period_end').eq('organization_id',m.organizationId).single(),'viewer subscription read');
  const billingWrite=await clients.viewer.from('organization_subscriptions').update({status:'active',plan_code:'premium',current_period_end:'2099-01-01T00:00:00Z'}).eq('id',subscriptionBefore.id).select('id');
  check('viewer cannot grant commercial entitlements',Boolean(billingWrite.error || !billingWrite.data?.length));
  const foreign='c7728100-6e58-46b6-aa07-220b262169ab';
  for(const table of ['organizations','third_parties','customer_invoices','supplier_invoices','treasury_accounts','accounting_entries']){
    const query=clients.viewer.from(table).select('id').eq(table==='organizations'?'id':'organization_id',foreign);
    const result=await query;check('viewer cannot read another company '+table,!result.error && result.data.length===0);
  }
  await login('admin');await workspace();
  const contact=await read(clients.admin.from('third_party_contacts').select('full_name').eq('id',record.contactId).single(),'contact after rejected viewer write');
  const address=await read(clients.admin.from('third_party_addresses').select('address').eq('id',record.addressId).single(),'address after rejected viewer write');
  check('contact and address remain intact',contact.full_name==='Contact de recette' && address.address==='10 rue fictive de recette');
  const subAfter=await read(clients.admin.from('organization_subscriptions').select('status,plan_code,current_period_end').eq('id',subscriptionBefore.id).single(),'subscription after rejected viewer write');
  check('commercial rights remain unchanged',subAfter.status===subscriptionBefore.status && subAfter.plan_code===subscriptionBefore.plan_code && subAfter.current_period_end===subscriptionBefore.current_period_end);
  await action('src/lib/treasury-actions.ts','createTreasuryAccount',{name:'Compte EUR refusé',currency:'EUR',account_type:'bank'},false);
  const bank=await read(clients.admin.from('treasury_accounts').select('current_balance,currency').eq('id',record.bankId).single(),'bank after rejected writes');
  check('rejected mutations preserve bank120 MAD',Number(bank.current_balance)===120 && bank.currency==='MAD');
}

async function team(){
  if(!m.records?.customerId)throw new Error('Complete the base business phase before team tests');
  for(const role of ['admin','operator','viewer']){await login(role);await workspace();}
  actor='admin';
  const members=await read(clients.admin.from('organization_members').select('id,user_id,role_id,status').eq('organization_id',m.organizationId),'three-user team');
  const memberByRole=Object.fromEntries(['admin','operator','viewer'].map(role=>[role,members.find(row=>row.user_id===m.users[role].id)]));
  check('three expected active team members exist',members.length===3 && Object.values(memberByRole).every(member=>member?.status==='active'));
  const viewerRole=m.roles.find(role=>role.name==='viewer');const operatorRole=m.roles.find(role=>role.name==='operator');const adminRole=m.roles.find(role=>role.name==='admin');
  check('three tenant role identifiers exist',Boolean(viewerRole && operatorRole && adminRole));
  const endpoint=runner.load('src/app/api/organization-members/[id]/route.ts');const roleEndpoint=runner.load('src/app/api/organization-members/[id]/role/route.ts');
  async function memberApi(method,id,body,roleChange=false,expected=200){
    const response=await (roleChange?roleEndpoint:endpoint)[method](new Request('https://www.felexia.pro/api/organization-members/'+id+(roleChange?'/role':''),{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({id})});
    const json=await response.json();check(actor+' membership '+method+(roleChange?' role':'')+' status '+expected,response.status===expected && (expected===200?json.success===true:json.success!==true));return json;
  }
  try{
    await memberApi('PATCH',memberByRole.viewer.id,{status:'disabled'});
    actor='viewer';
    check('disabled viewer loses workspace on existing session',await runner.load('src/lib/auth.ts').getActiveWorkspace()===null);
    const hidden=await read(clients.viewer.from('customer_invoices').select('id').eq('organization_id',m.organizationId),'disabled viewer invoice access');
    check('disabled viewer immediately loses company data access',hidden.length===0);
  }finally{actor='admin';await memberApi('PATCH',memberByRole.viewer.id,{status:'active'});}
  actor='viewer';check('reactivated viewer regains consultation on existing session',(await runner.load('src/lib/auth.ts').getActiveWorkspace())?.role==='viewer');
  actor='admin';const customer=await read(clients.admin.from('third_parties').select('notes').eq('organization_id',m.organizationId).eq('id',m.records.customerId).single(),'customer before role changes');
  try{
    await memberApi('PATCH',memberByRole.operator.id,{roleId:viewerRole.id},true);
    actor='operator';check('operator downgrade is immediate on existing session',(await runner.load('src/lib/auth.ts').getActiveWorkspace())?.role==='viewer');
    const denied=await clients.operator.from('third_parties').update({notes:'MODIFICATION INTERDITE APRÈS CHANGEMENT DE RÔLE'}).eq('organization_id',m.organizationId).eq('id',m.records.customerId).select('id');
    check('downgraded operator immediately loses writes',Boolean(denied.error || !denied.data?.length));
    await action('src/lib/invoice-actions.ts','createCustomerInvoice',{customer_id:m.records.customerId,invoice_date:today,lines:[freeLine('Interdit après rétrogradation',1,1)]},false);
  }finally{
    actor='admin';await memberApi('PATCH',memberByRole.operator.id,{roleId:operatorRole.id},true);
    const restore=await clients.admin.from('third_parties').update({notes:customer.notes}).eq('organization_id',m.organizationId).eq('id',m.records.customerId).select('id');check('customer notes restored after downgraded-role probe',!restore.error && restore.data?.length===1);
  }
  actor='operator';check('operator restoration is immediate on existing session',(await runner.load('src/lib/auth.ts').getActiveWorkspace())?.role==='operator');
  try{
    const written=await clients.operator.from('third_parties').update({notes:'RECETTE RÔLE OPÉRATEUR RESTAURÉ'}).eq('organization_id',m.organizationId).eq('id',m.records.customerId).select('id');
    check('restored operator immediately regains operational writes',!written.error && written.data?.length===1);
  }finally{
    actor='admin';const restore=await clients.admin.from('third_parties').update({notes:customer.notes}).eq('organization_id',m.organizationId).eq('id',m.records.customerId).select('id');check('customer notes restored after role test',!restore.error && restore.data?.length===1);
  }
  await memberApi('PATCH',memberByRole.admin.id,{status:'disabled'},false,403);
  await memberApi('DELETE',memberByRole.admin.id,undefined,false,403);
  await memberApi('PATCH',memberByRole.admin.id,{roleId:viewerRole.id},true,403);
  for(const role of ['operator','viewer']){
    actor=role;await memberApi('PATCH',memberByRole.viewer.id,{status:'disabled'},false,403);
    await memberApi('DELETE',memberByRole.viewer.id,undefined,false,403);
    await memberApi('PATCH',memberByRole.operator.id,{roleId:adminRole.id},true,403);
  }
  actor='admin';let smtpAttempts=0;
  const smtpTripwire={createClient:()=>({from(){throw new Error('Unexpected service-role write before quota check');},auth:{admin:{inviteUserByEmail(){smtpAttempts++;throw new Error('SMTP forbidden during quota test');}}}})};
  const quotaRunner=createActionRunner(()=>clients.admin,report.diagnostics,{modules:{'@/lib/supabase/service':smtpTripwire}});
  const before=await read(clients.admin.from('invitations').select('id').eq('organization_id',m.organizationId),'invitations before quota test');
  let quotaError;
  try{await quotaRunner.load('src/lib/auth/invite-user.ts').inviteOrganizationUser({email:mailboxName+'+recette'+Date.now()+'quota@'+mailboxDomain,roleId:viewerRole.id,fullName:'Quatrième utilisateur interdit par quota'});}catch(error){quotaError=error.code;}
  check('fourth user reservation is denied by the real quota',quotaError==='USER_LIMIT');check('quota refusal occurs before SMTP dispatch',smtpAttempts===0);
  const after=await read(clients.admin.from('invitations').select('id').eq('organization_id',m.organizationId),'invitations after quota test');
  check('quota refusal creates no pending invitation',before.length===after.length && before.every(row=>after.some(next=>next.id===row.id)));
  const restored=await read(clients.admin.from('organization_members').select('id,role_id,status').eq('organization_id',m.organizationId),'team after denied administration');
  check('team ends with original three active roles',restored.length===3 && restored.every(row=>row.status==='active' && row.role_id===members.find(previous=>previous.id===row.id)?.role_id));
  report.team={activeMembers:3,rolesRestored:true,immediateRevocation:true,immediateRoleChange:true,selfDisableDenied:true,lastAdminDowngradeDenied:true,fourthUserQuotaDenied:true,smtpAttempts};save();
}

async function supplierCredit(){
  const record=m.records;const c=m.supplierCorrections ||= {};
  await login('operator');await workspace();
  const futureForm={supplier_id:record.supplierId,supplier_invoice_number:'QA-ACHAT-AVOIR-002',invoice_date:today,source_type:'manual',lines:[freeLine('Facture à régler avec avoir',1,100)]};
  if(!c.invoiceId){const r=await action('src/lib/purchase-actions.ts','createSupplierInvoice',futureForm);c.invoiceId=idFrom(r);save();}
  const invoice=await read(clients.operator.from('supplier_invoices').select('status').eq('id',c.invoiceId).single(),'supplier credit target');
  if(invoice.status==='draft')await action('src/lib/purchase-actions.ts','validateSupplierInvoice',{id:c.invoiceId});
  const creditForm={supplier_id:record.supplierId,supplier_credit_note_number:'QA-AVOIR-FRS-001',source_invoice_id:record.purchaseId,credit_note_date:today,reason:'Correction fournisseur fictive de recette',lines:[freeLine('Avoir fournisseur de recette',1,10)]};
  if(!c.creditId){const r=await action('src/lib/supplier-credit-note-actions.ts','createSupplierCreditNote',creditForm);c.creditId=idFrom(r);save();}
  let note=await read(clients.operator.from('supplier_credit_notes').select('credit_note_number,status,total_ttc').eq('id',c.creditId).single(),'supplier credit draft');
  if(note.status==='draft'){
    const number=note.credit_note_number;
    await action('src/lib/supplier-credit-note-actions.ts','updateSupplierCreditNote',{...creditForm,id:c.creditId,lines:[freeLine('Avoir corrigé par opérateur',1,20)]});
    note=await read(clients.operator.from('supplier_credit_notes').select('credit_note_number,status,total_ttc').eq('id',c.creditId).single(),'updated supplier credit');
    check('supplier credit edit preserves number and recalculates24',note.credit_note_number===number && Number(note.total_ttc)===24);
    await action('src/lib/supplier-credit-note-actions.ts','validateSupplierCreditNote',{id:c.creditId});
  }
  if(!c.partialCorrectionVerified){
    await action('src/lib/supplier-credit-note-actions.ts','applySupplierCreditNote',{id:c.creditId,applications:[{invoice_id:c.invoiceId,amount:12}]});
    let row=await read(clients.operator.from('supplier_invoices').select('remaining_amount,credit_amount').eq('id',c.invoiceId).single(),'purchase after partial credit');
    check('supplier partial credit reduces remaining120 to108',Number(row.remaining_amount)===108 && Number(row.credit_amount)===12);
    const applications=await read(clients.operator.from('supplier_credit_note_applications').select('id').eq('credit_note_id',c.creditId).is('cancelled_at',null),'active supplier credit application');
    await action('src/lib/supplier-credit-note-actions.ts','unapplySupplierCreditNote',{application_id:applications[0].id});
    row=await read(clients.operator.from('supplier_invoices').select('remaining_amount').eq('id',c.invoiceId).single(),'purchase after credit removal');
    check('supplier credit removal restores remaining120',Number(row.remaining_amount)===120);c.partialCorrectionVerified=true;save();
  }
  await login('admin');
  await action('src/lib/accounting-actions.ts','postSupplierInvoiceToAccounting',{id:c.invoiceId});
  await action('src/lib/supplier-credit-note-actions.ts','postSupplierCreditNoteToAccounting',{id:c.creditId});
  await action('src/lib/supplier-credit-note-actions.ts','postSupplierCreditNoteToAccounting',{id:c.creditId});
  await action('src/lib/supplier-credit-note-actions.ts','cancelSupplierCreditNote',{id:c.creditId},false);
  const posted=await read(clients.admin.from('accounting_entries').select('id,total_debit,total_credit').eq('organization_id',m.organizationId).eq('source_document_type','supplier_credit_note').eq('source_document_id',c.creditId),'supplier credit journal entry');
  check('supplier credit posting is unique and balanced24',posted.length===1 && Number(posted[0].total_debit)===24 && Number(posted[0].total_credit)===24);
  await login('operator');
  if(!c.paymentId){
    await action('src/lib/supplier-credit-note-actions.ts','applySupplierCreditNote',{id:c.creditId,applications:[{invoice_id:c.invoiceId,amount:24}]});
    const r=await action('src/lib/purchase-actions.ts','createSupplierPayment',{supplier_id:record.supplierId,treasury_account_id:record.bankId,amount:96,payment_method:'bank_transfer',payment_date:today,idempotency_key:crypto.randomUUID(),allocations:[{invoice_id:c.invoiceId,amount:96}]});
    c.paymentId=idFrom(r);save();
  }
  let cleared=await read(clients.operator.from('supplier_invoices').select('total_ttc,paid_amount,credit_amount,remaining_amount').eq('id',c.invoiceId).single(),'supplier credit plus payment');
  check('credit24 plus payment96 clears purchase120',Number(cleared.paid_amount)===96 && Number(cleared.credit_amount)===24 && Number(cleared.remaining_amount)===0);
  if(!c.postedReallocationVerified){
    const applications=await read(clients.operator.from('supplier_credit_note_applications').select('id').eq('credit_note_id',c.creditId).is('cancelled_at',null),'posted supplier credit application');
    await action('src/lib/supplier-credit-note-actions.ts','unapplySupplierCreditNote',{application_id:applications[0].id});
    cleared=await read(clients.operator.from('supplier_invoices').select('remaining_amount').eq('id',c.invoiceId).single(),'posted supplier credit removal');
    check('operator can reassign posted credit without changing cash',Number(cleared.remaining_amount)===24);
    await action('src/lib/supplier-credit-note-actions.ts','applySupplierCreditNote',{id:c.creditId,applications:[{invoice_id:c.invoiceId,amount:24}]});
    c.postedReallocationVerified=true;save();
  }
  await login('admin');await action('src/lib/accounting-actions.ts','postSupplierPaymentToAccounting',{id:c.paymentId});
  const bank=await read(clients.admin.from('treasury_accounts').select('current_balance,currency').eq('id',record.bankId).single(),'bank after second supplier settlement');
  check('supplier credits create no cash and bank ends24 MAD',Number(bank.current_balance)===24 && bank.currency==='MAD');
  const ledger=await read(clients.admin.from('accounting_entries').select('id,total_debit,total_credit,status').eq('source_document_type','supplier_credit_note').eq('source_document_id',c.creditId),'supplier credit after reallocation');
  check('reallocation leaves supplier credit journal unchanged',ledger.length===1 && ledger[0].id===posted[0].id && Number(ledger[0].total_debit)===24);
  await login('viewer');await workspace();
  const visible=await read(clients.viewer.from('supplier_credit_notes').select('id,total_ttc').eq('id',c.creditId).single(),'viewer supplier credit read');
  check('viewer reads supplier credit',Number(visible.total_ttc)===24);
  const denied=await clients.viewer.from('supplier_credit_notes').update({total_ttc:999}).eq('id',c.creditId).select('id');
  check('viewer cannot mutate supplier credit directly',Boolean(denied.error || !denied.data?.length));
  report.financial={supplierCredit:24,secondSupplierPayment:96,secondPurchase:120,bankBalance:24};save();
}

async function main(){
  if(phase==='prepare')await prepare();
  else if(phase==='invite')await invite();
  else if(phase==='accept')await accept();
  else if(phase==='resend')await resend();
  else if(phase==='read')await readOnly();
  else if(phase==='business')await business();
  else if(phase==='boundaries')await boundaries();
  else if(phase==='team')await team();
  else if(phase==='supplier-credit')await supplierCredit();
  else if(phase==='finalize'){
    await login('admin');await workspace();
    check('final QA customer invoice exists',Boolean(m.corrections?.openSaleId));
    await action('src/lib/accounting-actions.ts','postCustomerInvoiceToAccounting',{id:m.corrections.openSaleId});
  }
  else if(phase==='browser-cleanup'){
    await login('operator');await workspace();
    check('browser-only QA invoice is identified',Boolean(m.browser?.invoiceId));
    await action('src/lib/invoice-actions.ts','cancelCustomerInvoice',{id:m.browser.invoiceId});
    await action('src/lib/invoice-actions.ts','archiveCustomerInvoice',{id:m.browser.invoiceId});
    m.browser.invoiceCancelledAndArchived=true;
  }
  else throw new Error('Unknown recette phase');
  report.success=true;
}
main().catch(error=>{report.success=false;report.failure=String(error.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]');process.exitCode=1;}).finally(()=>{save();console.log(JSON.stringify({phase,success:report.success,checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,failure:report.failure}));});
