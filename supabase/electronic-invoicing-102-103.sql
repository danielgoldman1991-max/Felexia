-- Felexia electronic documents: atomic installation of migrations102 and103.
-- Review and test in isolated preproduction before an authorized production installation.
begin;

-- Source: 102_electronic_invoicing_maroc.sql
-- SHA256: b652c64a8e1a4e349dcaa61bb9b886bf2cf155ab4c034a42e3074b12df9cb354
-- Felexia preparatory electronic invoicing. Additive; no DGI connection or signature.
-- Source business numbers, amounts, accounting and payments are never regenerated.

create table if not exists public.einvoice_settings(
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 enabled boolean not null default false, connector_mode text not null default 'disabled' check(connector_mode in('disabled','simulation')),
 configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'), revision integer not null default 1,
 updated_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.einvoice_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,
 source_kind text not null check(source_kind in('invoice','credit_note')), source_id uuid not null,
 source_invoice_id uuid generated always as(case when source_kind='invoice' then source_id end) stored references public.customer_invoices(id) on delete restrict,
 source_credit_note_id uuid generated always as(case when source_kind='credit_note' then source_id end) stored references public.customer_credit_notes(id) on delete restrict,
 source_number text not null,source_date date not null,currency text not null,
 status text not null default 'draft' check(status in('draft','validated','issued','ready_to_submit')),
 simulation_status text not null default 'not_submitted' check(simulation_status in('not_submitted','queued','pending','transmitted','accepted','rejected','unknown')),
 official boolean not null default false check(not official),current_version_id uuid,current_version_number integer not null default 0,
 issued_at timestamptz,issued_by uuid,created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,source_kind,source_id),unique(organization_id,id)
);
create table if not exists public.einvoice_versions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,version_number integer not null check(version_number>0),
 source_fingerprint text not null check(source_fingerprint~'^[0-9a-f]{64}$'),configuration_fingerprint text not null check(configuration_fingerprint~'^[0-9a-f]{64}$'),snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),canonical_snapshot text not null,
 snapshot_sha256 text not null check(snapshot_sha256~'^[0-9a-f]{64}$'),profile_version text not null,previous_version_id uuid,
 idempotency_key uuid not null,request_hash text not null,created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(organization_id,document_id) references public.einvoice_documents(organization_id,id) on delete restrict,
 unique(organization_id,document_id,version_number),unique(organization_id,id),unique(organization_id,document_id,id),unique(organization_id,idempotency_key),
 foreign key(organization_id,previous_version_id) references public.einvoice_versions(organization_id,id) on delete restrict
);
alter table public.einvoice_versions add column if not exists configuration_fingerprint text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='einvoice_current_version_fk' and conrelid='public.einvoice_documents'::regclass) then
  alter table public.einvoice_documents add constraint einvoice_current_version_fk foreign key(organization_id,id,current_version_id) references public.einvoice_versions(organization_id,document_id,id) on delete restrict;
 end if;
end $$;

create table if not exists public.einvoice_artifacts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,version_id uuid not null,
 format text not null check(format in('xml','pdf')),mime_type text not null,content bytea not null,byte_length integer not null check(byte_length between 1 and 4194304),
 sha256 text not null check(sha256~'^[0-9a-f]{64}$'),canonical_sha256 text check(canonical_sha256 is null or canonical_sha256~'^[0-9a-f]{64}$'),
 signed boolean not null default false check(not signed),created_at timestamptz not null default now(),
 foreign key(organization_id,document_id,version_id) references public.einvoice_versions(organization_id,document_id,id) on delete restrict,
 unique(version_id,format),unique(organization_id,id)
);
create table if not exists public.einvoice_validations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,version_id uuid not null,
 valid boolean not null,result jsonb not null,official_conformity boolean not null default false check(not official_conformity),created_at timestamptz not null default now(),
 foreign key(organization_id,document_id,version_id) references public.einvoice_versions(organization_id,document_id,id) on delete restrict,
 unique(version_id)
);
create table if not exists public.einvoice_transmissions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,version_id uuid not null,
 scenario text not null check(scenario in('accept','reject','timeout','unavailable')),idempotency_key uuid not null,payload_hash text not null,
 simulation boolean not null default true check(simulation),authority text not null default 'FELEXIA_INTERNAL_SIMULATION' check(authority='FELEXIA_INTERNAL_SIMULATION'),
 status text not null default 'queued' check(status in('queued','pending','transmitted','accepted','rejected','unknown')),
 acknowledgement jsonb,acknowledgement_sha256 text,error_code text,created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,document_id,version_id) references public.einvoice_versions(organization_id,document_id,id) on delete restrict,
 unique(organization_id,idempotency_key),unique(organization_id,id)
);
create table if not exists public.einvoice_jobs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,document_id uuid not null,version_id uuid not null,transmission_id uuid not null,
 scenario text not null check(scenario in('accept','reject','timeout','unavailable')),status text not null default 'queued' check(status in('queued','running','retry_wait','succeeded','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),available_at timestamptz not null default now(),lease_token uuid,lease_expires_at timestamptz,worker text,
 error_code text,finish_hash text,created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(organization_id,document_id,version_id) references public.einvoice_versions(organization_id,document_id,id) on delete restrict,
 foreign key(organization_id,transmission_id) references public.einvoice_transmissions(organization_id,id) on delete restrict,
 unique(transmission_id)
);
alter table public.einvoice_jobs add column if not exists finish_hash text;
create unique index if not exists einvoice_one_open_job_per_version on public.einvoice_jobs(version_id) where status in('queued','running','retry_wait');
create index if not exists einvoice_job_claim on public.einvoice_jobs(status,available_at,lease_expires_at);
create index if not exists einvoice_document_list on public.einvoice_documents(organization_id,created_at desc,id);
create table if not exists public.einvoice_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete restrict,document_id uuid,
 sequence bigint not null,actor_id uuid,event text not null,severity text not null check(severity in('info','warning','error')),
 metadata jsonb not null default '{}'::jsonb,previous_hash text,event_hash text not null,created_at timestamptz not null,
 foreign key(organization_id,document_id) references public.einvoice_documents(organization_id,id) on delete restrict,unique(organization_id,sequence)
);

create or replace function app_private.einvoice_assert_actor(p_actor uuid,p_org uuid,p_admin boolean default false,p_write boolean default true)
returns void language plpgsql security definer set search_path=public,app_private as $$
declare role_name text; sub record;
begin
 if p_actor is null then raise exception 'EINVOICE_AUTH_REQUIRED' using errcode='42501';end if;
 select lower(btrim(r.name)) into role_name from public.organization_members m join public.roles r on r.id=m.role_id and r.organization_id=m.organization_id where m.organization_id=p_org and m.user_id=p_actor and m.status='active' limit 1;
 if role_name is null then raise exception 'EINVOICE_ACCESS_DENIED' using errcode='42501';end if;
 if p_admin and role_name not in('owner','admin') then raise exception 'EINVOICE_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_write and role_name not in('owner','admin','operator','operateur','opérateur') then raise exception 'EINVOICE_WRITE_REQUIRED' using errcode='42501';end if;
 if p_write then
  select status,coalesce(trial_ends_at,trial_end) trial_end,current_period_end into sub from public.organization_subscriptions where organization_id=p_org order by created_at desc limit 1 for share;
  if not found or not coalesce((sub.status in('trialing','trial') and sub.trial_end>clock_timestamp()) or (sub.status='active' and sub.current_period_end>clock_timestamp()),false) then raise exception 'SUBSCRIPTION_WRITE_REQUIRED' using errcode='42501';end if;
 end if;
end $$;
revoke all on function app_private.einvoice_assert_actor(uuid,uuid,boolean,boolean) from public,anon,authenticated;

create or replace function app_private.einvoice_safe_metadata(p_data jsonb)
returns void language plpgsql immutable security invoker set search_path=public,app_private as $$
begin
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>65536 or p_data::text~*'"(password|authorization|cookie|access_token|refresh_token|api_key|private_key|content_base64|xml|pdf|snapshot)"[[:space:]]*:' or p_data::text~*'BEGIN[^-]*PRIVATE KEY' then raise exception 'EINVOICE_UNSAFE_METADATA' using errcode='22023';end if;
end $$;
revoke all on function app_private.einvoice_safe_metadata(jsonb) from public,anon,authenticated;

create or replace function app_private.einvoice_append_event(p_actor uuid,p_org uuid,p_doc uuid,p_event text,p_severity text,p_metadata jsonb)
returns uuid language plpgsql security definer set search_path=public,app_private as $$
declare seq bigint; previous text; event_id uuid:=gen_random_uuid();at_time timestamptz:=clock_timestamp(); hashed text;
begin
 perform app_private.einvoice_safe_metadata(p_metadata);
 if p_event !~ '^[A-Za-z0-9_.:-]{1,100}$' or p_severity not in('info','warning','error') then raise exception 'EINVOICE_INVALID_EVENT' using errcode='22023';end if;
 if p_doc is not null and not exists(select 1 from public.einvoice_documents where id=p_doc and organization_id=p_org) then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('einvoice-events:'||p_org::text,0));
 select sequence,event_hash into seq,previous from public.einvoice_events where organization_id=p_org order by sequence desc limit 1;
 seq:=coalesce(seq,0)+1;hashed:=encode(sha256(convert_to(jsonb_build_object('id',event_id,'org',p_org,'document',p_doc,'sequence',seq,'actor',p_actor,'event',p_event,'severity',p_severity,'metadata',p_metadata,'previous_hash',previous,'at',at_time)::text,'UTF8')),'hex');
 insert into public.einvoice_events(id,organization_id,document_id,sequence,actor_id,event,severity,metadata,previous_hash,event_hash,created_at) values(event_id,p_org,p_doc,seq,p_actor,p_event,p_severity,p_metadata,previous,hashed,at_time);
 return event_id;
end $$;
revoke all on function app_private.einvoice_append_event(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function app_private.einvoice_immutable()
returns trigger language plpgsql security definer set search_path=public,app_private as $$begin raise exception 'EINVOICE_IMMUTABLE_ARCHIVE' using errcode='42501';end $$;
revoke all on function app_private.einvoice_immutable() from public,anon,authenticated;
do $$ declare tab text;begin
 foreach tab in array array['einvoice_settings','einvoice_documents','einvoice_versions','einvoice_artifacts','einvoice_validations','einvoice_transmissions','einvoice_jobs','einvoice_events'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke all on public.%I from service_role',tab);end if;
  execute format('grant select on public.%I to authenticated',tab);
  execute format('drop policy if exists einvoice_tenant_read on public.%I',tab);
  execute format('create policy einvoice_tenant_read on public.%I for select to authenticated using(app_private.has_active_org_membership(organization_id))',tab);
 end loop;
 foreach tab in array array['einvoice_versions','einvoice_artifacts','einvoice_validations','einvoice_events'] loop
  execute format('drop trigger if exists einvoice_append_only on public.%I',tab);
  execute format('create trigger einvoice_append_only before update or delete on public.%I for each row execute function app_private.einvoice_immutable()',tab);
 end loop;
end $$;

create or replace function app_private.einvoice_capture(p_kind text,p_id uuid,p_lock boolean default false)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare src jsonb;org_id uuid;org jsonb;company jsonb;party jsonb;seller jsonb;buyer jsonb;header jsonb;lines jsonb;facts jsonb; original jsonb;config jsonb;fiscal_config jsonb;
begin
 if p_kind='invoice' then
  if p_lock then select to_jsonb(i) into src from public.customer_invoices i where id=p_id for update;else select to_jsonb(i) into src from public.customer_invoices i where id=p_id;end if;
 elsif p_kind='credit_note' then
  if p_lock then select to_jsonb(i) into src from public.customer_credit_notes i where id=p_id for update;else select to_jsonb(i) into src from public.customer_credit_notes i where id=p_id;end if;
 else raise exception 'EINVOICE_INVALID_SOURCE_KIND' using errcode='22023';end if;
 if src is null then raise exception 'EINVOICE_SOURCE_NOT_AVAILABLE' using errcode='42501';end if;
 org_id:=(src->>'organization_id')::uuid;
 if p_lock then
  perform 1 from public.organizations where id=org_id for share;
  perform 1 from public.company_settings where organization_id=org_id for share;
  perform 1 from public.third_parties where id=(src->>'customer_id')::uuid and organization_id=org_id for share;
  perform 1 from public.einvoice_settings where organization_id=org_id for share;
 end if;
 select to_jsonb(o) into org from public.organizations o where id=org_id;
 select to_jsonb(c) into company from public.company_settings c where organization_id=org_id limit 1;
 company:=coalesce(company,'{}'::jsonb);
 select to_jsonb(t) into party from public.third_parties t where id=(src->>'customer_id')::uuid and organization_id=org_id;
 if party is null then raise exception 'EINVOICE_SOURCE_NOT_AVAILABLE' using errcode='42501';end if;
 seller:=jsonb_build_object('name',coalesce(nullif(btrim(company->>'legal_name'),''),nullif(btrim(company->>'commercial_name'),''),nullif(btrim(org->>'legal_name'),''),org->>'name'),
  'address',coalesce(company->>'address',org->>'address'),'city',coalesce(company->>'city',org->>'city'),'country',coalesce(company->>'country',org->>'country','Maroc'),
  'ice',coalesce(nullif(company->>'ice',''),org->>'ice'),'if_number',coalesce(nullif(company->>'if_number',''),nullif(company->>'tax_identifier',''),nullif(org->>'if_number',''),org->>'tax_identifier'),
  'rc',coalesce(nullif(company->>'rc',''),org->>'rc'),'patente',coalesce(company->>'patente',company->>'tp'),'cnss',coalesce(company->>'cnss',org->>'cnss'),'phone',coalesce(company->>'phone',org->>'phone'),'email',coalesce(company->>'email',org->>'email'));
 buyer:=jsonb_build_object('id',party->>'id','name',party->>'name','address',party->>'address','city',party->>'city','postal_code',party->>'postal_code','country',party->>'country','ice',party->>'ice','if_number',party->>'if_number','rc',party->>'rc','patente',coalesce(party->>'patente',party->>'tp'),'cnss',party->>'cnss','phone',coalesce(party->>'phone',party->>'mobile'),'email',party->>'email');
 if p_kind='credit_note' and src->>'source_invoice_id' is not null then select to_jsonb(i) into original from public.customer_invoices i where id=(src->>'source_invoice_id')::uuid and organization_id=org_id;end if;
 header:=jsonb_build_object('id',p_id,'number',coalesce(src->>'invoice_number',src->>'credit_note_number'),'date',coalesce(src->>'invoice_date',src->>'credit_note_date'),'due_date',src->>'due_date','currency',src->>'currency',
  'subtotal_ht',src->>'subtotal_ht','discount_total',src->>'discount_total','tax_total',src->>'tax_total','total_ttc',src->>'total_ttc','payment_terms',coalesce(src->>'custom_payment_terms',src->>'payment_terms'),'payment_method',coalesce(src->>'custom_payment_method',src->>'payment_method'),'notes',src->>'notes','reason',src->>'reason',
  'original_invoice_id',original->>'id','original_invoice_number',original->>'invoice_number','original_invoice_date',original->>'invoice_date');
 if p_kind='invoice' then
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'line_order',l.line_order,'product_name',l.product_name,'description',l.description,'quantity',l.quantity::text,'unit_price_ht',l.unit_price_ht::text,'discount_rate',l.discount_rate::text,'tax_rate',l.tax_rate::text,'subtotal_ht',l.subtotal_ht::text,'discount_amount',l.discount_amount::text,'tax_amount',l.tax_amount::text,'total_ttc',l.total_ttc::text,'unit_id',l.unit_id,'unit_name',l.unit_name) order by l.line_order,l.id),'[]'::jsonb) into lines from public.customer_invoice_lines l where invoice_id=p_id and organization_id=org_id;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'line_order',l.line_order,'product_name',l.product_name,'description',l.description,'quantity',l.quantity::text,'unit_price_ht',l.unit_price_ht::text,'discount_rate',l.discount_rate::text,'tax_rate',l.tax_rate::text,'subtotal_ht',l.subtotal_ht::text,'discount_amount',l.discount_amount::text,'tax_amount',l.tax_amount::text,'total_ttc',l.total_ttc::text,'unit_id',l.unit_id,'unit_name',l.unit_name) order by l.line_order,l.id),'[]'::jsonb) into lines from public.customer_credit_note_lines l where credit_note_id=p_id and organization_id=org_id;
 end if;
 facts:=jsonb_build_object('seller',seller,'buyer',buyer,'header',header,'lines',lines);
 select configuration into config from public.einvoice_settings where organization_id=org_id;
 config:=coalesce(config,'{}'::jsonb);
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into fiscal_config from jsonb_each(config) where key in('buyer_type','require_seller_rc','default_unit_code','line_metadata');
 return jsonb_build_object('organization_id',org_id,'source_kind',p_kind,'source_id',p_id,'source_status',src->>'status','eligible',
  ((p_kind='invoice' and src->>'status' in('validated','sent','partially_paid','paid','overdue')) or (p_kind='credit_note' and src->>'status' in('validated','applied','partially_applied')))
  and src->>'archived_at' is null and jsonb_array_length(lines)>0 and (src->>'total_ttc')::numeric>0,'source_fingerprint',encode(sha256(convert_to(facts::text,'UTF8')),'hex'),'configuration',config,'configuration_fingerprint',encode(sha256(convert_to(fiscal_config::text,'UTF8')),'hex'),'facts',facts);
end $$;
revoke all on function app_private.einvoice_capture(text,uuid,boolean) from public,anon,authenticated;

create or replace function public.einvoice_capture_source(p_source_kind text,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare captured jsonb;begin
 captured:=app_private.einvoice_capture(p_source_kind,p_source_id,false);
 perform app_private.einvoice_assert_actor(auth.uid(),(captured->>'organization_id')::uuid,false,false);return captured;
end $$;

create or replace function public.einvoice_update_settings(p_organization_id uuid,p_enabled boolean,p_mode text,p_configuration jsonb default '{}'::jsonb,p_expected_revision integer default null)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare current_settings public.einvoice_settings%rowtype; result public.einvoice_settings%rowtype;begin
 perform app_private.einvoice_assert_actor(auth.uid(),p_organization_id,true,true);
 if p_enabled is null or p_mode is null or p_mode not in('disabled','simulation') or jsonb_typeof(p_configuration) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_configuration) k where k not in('buyer_type','require_seller_rc','default_unit_code','language','line_metadata','alerts_enabled')) then raise exception 'EINVOICE_INVALID_SETTINGS' using errcode='22023';end if;
 perform app_private.einvoice_safe_metadata(p_configuration);
 if (p_configuration?'alerts_enabled' and jsonb_typeof(p_configuration->'alerts_enabled')<>'boolean') or (p_configuration?'require_seller_rc' and jsonb_typeof(p_configuration->'require_seller_rc')<>'boolean')
  or (p_configuration?'buyer_type' and (jsonb_typeof(p_configuration->'buyer_type')<>'string' or p_configuration->>'buyer_type' not in('business','consumer','export')))
  or (p_configuration?'language' and (jsonb_typeof(p_configuration->'language')<>'string' or p_configuration->>'language' not in('fr','ar','en')))
  or (p_configuration?'line_metadata' and jsonb_typeof(p_configuration->'line_metadata')<>'object')
  or (p_configuration?'default_unit_code' and (jsonb_typeof(p_configuration->'default_unit_code')<>'string' or p_configuration->>'default_unit_code' !~ '^[A-Z0-9]{1,8}$')) then raise exception 'EINVOICE_INVALID_SETTINGS' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('einvoice-settings:'||p_organization_id::text,0));
 select * into current_settings from public.einvoice_settings where organization_id=p_organization_id for update;
 if found and p_expected_revision is distinct from current_settings.revision then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 insert into public.einvoice_settings(organization_id,enabled,connector_mode,configuration,updated_by) values(p_organization_id,p_enabled,p_mode,p_configuration,auth.uid())
 on conflict(organization_id) do update set enabled=excluded.enabled,connector_mode=excluded.connector_mode,configuration=excluded.configuration,revision=einvoice_settings.revision+1,updated_by=excluded.updated_by,updated_at=now() returning * into result;
 perform app_private.einvoice_append_event(auth.uid(),p_organization_id,null,'settings.updated','info',jsonb_build_object('enabled',p_enabled,'mode',p_mode,'revision',result.revision));return to_jsonb(result);
end $$;


create or replace function public.einvoice_save_preparation(
 p_actor uuid,p_source_kind text,p_source_id uuid,p_source_fingerprint text,p_snapshot jsonb,p_canonical_snapshot text,p_validation jsonb,p_artifacts jsonb,p_profile_version text,
 p_expected_version integer default null,p_idempotency_key uuid default null
)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare captured jsonb;org_id uuid;doc public.einvoice_documents%rowtype;version public.einvoice_versions%rowtype; prior public.einvoice_versions%rowtype;
 settings public.einvoice_settings%rowtype; artifact jsonb; bytes bytea;digest text;request_digest text;snapshot_digest text;version_id uuid:=gen_random_uuid();number_next integer;format_name text;kind_name text;
begin
 captured:=app_private.einvoice_capture(p_source_kind,p_source_id,false);org_id:=(captured->>'organization_id')::uuid;
 perform app_private.einvoice_assert_actor(p_actor,org_id,false,true);
 perform pg_advisory_xact_lock(hashtextextended('einvoice-source:'||org_id::text||':'||p_source_kind||':'||p_source_id::text,0));
 captured:=app_private.einvoice_capture(p_source_kind,p_source_id,true);
 select * into settings from public.einvoice_settings where organization_id=org_id for share;
 if not found or not settings.enabled then raise exception 'EINVOICE_MODULE_DISABLED' using errcode='42501';end if;
 if not coalesce((captured->>'eligible')::boolean,false) then raise exception 'EINVOICE_SOURCE_NOT_VALIDATED' using errcode='23514';end if;
 if p_source_fingerprint is distinct from captured->>'source_fingerprint' then raise exception 'EINVOICE_SOURCE_CHANGED' using errcode='40001';end if;
 if p_validation->>'configuration_fingerprint' is distinct from captured->>'configuration_fingerprint' then raise exception 'EINVOICE_CONFIGURATION_CHANGED' using errcode='40001';end if;
 if p_idempotency_key is null or jsonb_typeof(p_snapshot) is distinct from 'object' or p_canonical_snapshot is null or octet_length(p_canonical_snapshot)>2097152 or nullif(btrim(p_profile_version),'') is null or length(p_profile_version)>120 then raise exception 'EINVOICE_INVALID_PREPARATION' using errcode='22023';end if;
 if p_canonical_snapshot::jsonb is distinct from p_snapshot then raise exception 'EINVOICE_CANONICAL_MISMATCH' using errcode='23514';end if;
 kind_name:=case when p_source_kind='invoice' then 'customer_invoice' else 'customer_credit_note' end;
 if p_snapshot->>'organizationId' is distinct from org_id::text or p_snapshot->>'sourceId' is distinct from p_source_id::text or p_snapshot->>'sourceType' is distinct from kind_name or p_snapshot->>'number' is distinct from captured#>>'{facts,header,number}'
  or p_snapshot#>>'{sourceTotals,subtotalHt}' is distinct from captured#>>'{facts,header,subtotal_ht}' or p_snapshot#>>'{sourceTotals,discountTotal}' is distinct from captured#>>'{facts,header,discount_total}' or p_snapshot#>>'{sourceTotals,taxTotal}' is distinct from captured#>>'{facts,header,tax_total}' or p_snapshot#>>'{sourceTotals,totalTtc}' is distinct from captured#>>'{facts,header,total_ttc}' then raise exception 'EINVOICE_SNAPSHOT_SOURCE_MISMATCH' using errcode='23514';end if;
 request_digest:=encode(sha256(convert_to(jsonb_build_array(p_source_kind,p_source_id,p_source_fingerprint,captured->>'configuration_fingerprint',p_canonical_snapshot,p_profile_version)::text,'UTF8')),'hex');
 select * into prior from public.einvoice_versions where organization_id=org_id and idempotency_key=p_idempotency_key;
 if found then
  if prior.request_hash<>request_digest then raise exception 'EINVOICE_IDEMPOTENCY_CONFLICT' using errcode='23514';end if;
  select * into doc from public.einvoice_documents where id=prior.document_id and organization_id=org_id;
  return jsonb_build_object('document_id',doc.id,'version_id',prior.id,'version_number',prior.version_number,'current_version_number',doc.current_version_number,'status',doc.status,'snapshot_sha256',prior.snapshot_sha256,'source_fingerprint',prior.source_fingerprint,'reused',true);
 end if;
 if jsonb_typeof(p_validation) is distinct from 'object' or jsonb_typeof(p_validation->'valid') is distinct from 'boolean' or jsonb_typeof(p_validation->'issues') is distinct from 'array' or jsonb_typeof(p_validation#>'{xsd,valid}') is distinct from 'boolean' or octet_length(p_validation::text)>1048576 then raise exception 'EINVOICE_INVALID_VALIDATION' using errcode='23514';end if;
 if (p_validation->>'valid')::boolean and not (p_validation#>>'{xsd,valid}')::boolean then raise exception 'EINVOICE_INVALID_VALIDATION' using errcode='23514';end if;
 if (p_validation->>'valid')::boolean and (nullif(btrim(p_validation#>>'{xsd,engine}'),'') is null or coalesce(p_validation#>>'{xsd,schema_sha256}','') !~'^[0-9a-f]{64}$') then raise exception 'EINVOICE_INVALID_VALIDATION' using errcode='23514';end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' then raise exception 'EINVOICE_ARTIFACTS_REQUIRED' using errcode='23514';end if;
 if (p_validation->>'valid')::boolean then
  if jsonb_array_length(p_artifacts)<>2 or (select count(distinct value->>'format') from jsonb_array_elements(p_artifacts))<>2 or exists(select 1 from jsonb_array_elements(p_artifacts) where value->>'format' not in('xml','pdf')) then raise exception 'EINVOICE_ARTIFACTS_REQUIRED' using errcode='23514';end if;
 elsif jsonb_array_length(p_artifacts)<>0 then raise exception 'EINVOICE_ARTIFACTS_REQUIRED' using errcode='23514';end if;
 select * into doc from public.einvoice_documents where organization_id=org_id and source_kind=p_source_kind and source_id=p_source_id for update;
 if found then
  if doc.issued_at is not null or doc.status not in('draft','validated') then raise exception 'EINVOICE_ALREADY_ISSUED' using errcode='42501';end if;
  if p_expected_version is distinct from doc.current_version_number then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 else
  if p_expected_version is not null and p_expected_version<>0 then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
  insert into public.einvoice_documents(organization_id,source_kind,source_id,source_number,source_date,currency,created_by) values(org_id,p_source_kind,p_source_id,captured#>>'{facts,header,number}',(captured#>>'{facts,header,date}')::date,captured#>>'{facts,header,currency}',p_actor) returning * into doc;
 end if;
 number_next:=doc.current_version_number+1;snapshot_digest:=encode(sha256(convert_to(p_canonical_snapshot,'UTF8')),'hex');
 insert into public.einvoice_versions(id,organization_id,document_id,version_number,source_fingerprint,configuration_fingerprint,snapshot,canonical_snapshot,snapshot_sha256,profile_version,previous_version_id,idempotency_key,request_hash,created_by)
 values(version_id,org_id,doc.id,number_next,p_source_fingerprint,captured->>'configuration_fingerprint',p_snapshot,p_canonical_snapshot,snapshot_digest,p_profile_version,doc.current_version_id,p_idempotency_key,request_digest,p_actor) returning * into version;
 for artifact in select value from jsonb_array_elements(p_artifacts) loop
  format_name:=artifact->>'format';bytes:=decode(artifact->>'content_base64','base64');digest:=encode(sha256(bytes),'hex');
  if bytes is null or octet_length(bytes) not between 1 and 4194304 or digest is distinct from lower(artifact->>'sha256') or (artifact->>'canonical_sha256' is not null and artifact->>'canonical_sha256' !~'^[0-9a-f]{64}$') then raise exception 'EINVOICE_ARTIFACT_HASH_MISMATCH' using errcode='23514';end if;
  if format_name='xml' then
   if artifact->>'mime_type' not in('application/xml','text/xml') or octet_length(bytes)>2097152 or convert_from(bytes,'UTF8')~*'<![[:space:]]*(DOCTYPE|ENTITY)' then raise exception 'EINVOICE_UNSAFE_XML' using errcode='23514';end if;
  elsif artifact->>'mime_type'<>'application/pdf' or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'EINVOICE_INVALID_PDF' using errcode='23514';end if;
  insert into public.einvoice_artifacts(organization_id,document_id,version_id,format,mime_type,content,byte_length,sha256,canonical_sha256) values(org_id,doc.id,version_id,format_name,artifact->>'mime_type',bytes,octet_length(bytes),digest,artifact->>'canonical_sha256');
 end loop;
 insert into public.einvoice_validations(organization_id,document_id,version_id,valid,result) values(org_id,doc.id,version_id,(p_validation->>'valid')::boolean and (p_validation#>>'{xsd,valid}')::boolean,p_validation);
 update public.einvoice_documents set current_version_id=version_id,current_version_number=number_next,status='draft',updated_at=now() where id=doc.id and organization_id=org_id;
 perform app_private.einvoice_append_event(p_actor,org_id,doc.id,'preparation.created','info',jsonb_build_object('version_number',number_next,'profile_version',p_profile_version,'validation_valid',(p_validation->>'valid')::boolean,'snapshot_sha256',snapshot_digest));
 return jsonb_build_object('document_id',doc.id,'version_id',version_id,'version_number',number_next,'current_version_number',number_next,'status','draft','snapshot_sha256',snapshot_digest,'source_fingerprint',p_source_fingerprint,'reused',false);
end $$;

create or replace function public.einvoice_transition(p_document_id uuid,p_expected_version integer,p_target text)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare doc public.einvoice_documents%rowtype;version public.einvoice_versions%rowtype; captured jsonb;
begin
 select * into doc from public.einvoice_documents where id=p_document_id;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(auth.uid(),doc.organization_id,false,true);
 perform pg_advisory_xact_lock(hashtextextended('einvoice-source:'||doc.organization_id::text||':'||doc.source_kind||':'||doc.source_id::text,0));
 select * into doc from public.einvoice_documents where id=p_document_id for update;
 if p_expected_version is distinct from doc.current_version_number then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 if p_target is null or p_target not in('validated','issued','ready_to_submit') then raise exception 'EINVOICE_INVALID_TRANSITION' using errcode='23514';end if;
 if doc.status=p_target then return jsonb_build_object('document_id',doc.id,'version_id',doc.current_version_id,'version_number',doc.current_version_number,'status',doc.status,'reused',true);end if;
 if not exists(select 1 from public.einvoice_settings where organization_id=doc.organization_id and enabled) then raise exception 'EINVOICE_MODULE_DISABLED' using errcode='42501';end if;
 if (p_target='validated' and doc.status<>'draft') or (p_target='issued' and doc.status<>'validated') or (p_target='ready_to_submit' and doc.status<>'issued') then raise exception 'EINVOICE_INVALID_TRANSITION' using errcode='23514';end if;
 select * into version from public.einvoice_versions where id=doc.current_version_id and document_id=doc.id and organization_id=doc.organization_id;
 if not found or (select count(*) from public.einvoice_artifacts where version_id=version.id and organization_id=doc.organization_id)<>2 or not exists(select 1 from public.einvoice_validations where version_id=version.id and organization_id=doc.organization_id and valid) then raise exception 'EINVOICE_VALID_ARTIFACTS_REQUIRED' using errcode='23514';end if;
 if p_target='issued' then
  captured:=app_private.einvoice_capture(doc.source_kind,doc.source_id,true);
  if not coalesce((captured->>'eligible')::boolean,false) then raise exception 'EINVOICE_SOURCE_NOT_VALIDATED' using errcode='23514';end if;
  if captured->>'source_fingerprint' is distinct from version.source_fingerprint then raise exception 'EINVOICE_SOURCE_CHANGED' using errcode='40001';end if;
  if captured->>'configuration_fingerprint' is distinct from version.configuration_fingerprint then raise exception 'EINVOICE_CONFIGURATION_CHANGED' using errcode='40001';end if;
 end if;
 update public.einvoice_documents set status=p_target,issued_at=case when p_target='issued' then now() else issued_at end,issued_by=case when p_target='issued' then auth.uid() else issued_by end,updated_at=now() where id=doc.id;
 perform app_private.einvoice_append_event(auth.uid(),doc.organization_id,doc.id,'document.'||p_target,'info',jsonb_build_object('version_number',doc.current_version_number));
 return jsonb_build_object('document_id',doc.id,'version_id',version.id,'version_number',version.version_number,'status',p_target,'snapshot_sha256',version.snapshot_sha256,'reused',false);
end $$;

create or replace function public.einvoice_get_artifact(p_artifact_id uuid)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare artifact public.einvoice_artifacts%rowtype;
begin
 select * into artifact from public.einvoice_artifacts where id=p_artifact_id;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(auth.uid(),artifact.organization_id,false,false);
 if encode(sha256(artifact.content),'hex')<>artifact.sha256 or octet_length(artifact.content)<>artifact.byte_length then raise exception 'EINVOICE_ARCHIVE_INTEGRITY_FAILED' using errcode='23514';end if;
 return jsonb_build_object('id',artifact.id,'document_id',artifact.document_id,'version_id',artifact.version_id,'format',artifact.format,'mime_type',artifact.mime_type,'sha256',artifact.sha256,'canonical_sha256',artifact.canonical_sha256,'byte_length',artifact.byte_length,'content_base64',encode(artifact.content,'base64'));
end $$;

create or replace function public.einvoice_enqueue_simulation(p_document_id uuid,p_expected_version integer,p_scenario text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare doc public.einvoice_documents%rowtype;existing public.einvoice_transmissions%rowtype; job public.einvoice_jobs%rowtype; transmission uuid:=gen_random_uuid();payload text;
begin
 select * into doc from public.einvoice_documents where id=p_document_id for update;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(auth.uid(),doc.organization_id,true,true);
 if p_expected_version is distinct from doc.current_version_number then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 if p_scenario is null or p_scenario not in('accept','reject','timeout','unavailable') or p_idempotency_key is null then raise exception 'EINVOICE_INVALID_SIMULATION' using errcode='22023';end if;
 payload:=encode(sha256(convert_to(jsonb_build_array(doc.id,doc.current_version_id,p_scenario,'FELEXIA_INTERNAL_SIMULATION')::text,'UTF8')),'hex');
 select * into existing from public.einvoice_transmissions where organization_id=doc.organization_id and idempotency_key=p_idempotency_key;
 if found then
  if existing.payload_hash<>payload then raise exception 'EINVOICE_IDEMPOTENCY_CONFLICT' using errcode='23514';end if;
  select * into job from public.einvoice_jobs where transmission_id=existing.id;
  return jsonb_build_object('job_id',job.id,'transmission_id',existing.id,'status',job.status,'reused',true);
 end if;
 if doc.status<>'ready_to_submit' or doc.issued_at is null then raise exception 'EINVOICE_NOT_READY' using errcode='23514';end if;
 if not exists(select 1 from public.einvoice_settings where organization_id=doc.organization_id and enabled and connector_mode='simulation') then raise exception 'EINVOICE_SIMULATION_DISABLED' using errcode='42501';end if;
 if exists(select 1 from public.einvoice_jobs where version_id=doc.current_version_id and status in('queued','running','retry_wait')) then raise exception 'EINVOICE_JOB_ALREADY_QUEUED' using errcode='23514';end if;
 insert into public.einvoice_transmissions(id,organization_id,document_id,version_id,scenario,idempotency_key,payload_hash,created_by) values(transmission,doc.organization_id,doc.id,doc.current_version_id,p_scenario,p_idempotency_key,payload,auth.uid());
 insert into public.einvoice_jobs(organization_id,document_id,version_id,transmission_id,scenario,created_by) values(doc.organization_id,doc.id,doc.current_version_id,transmission,p_scenario,auth.uid()) returning * into job;
 update public.einvoice_documents set simulation_status='queued',updated_at=now() where id=doc.id;
 perform app_private.einvoice_append_event(auth.uid(),doc.organization_id,doc.id,'simulation.queued','info',jsonb_build_object('scenario',p_scenario,'version_number',doc.current_version_number,'simulation',true));
 return jsonb_build_object('job_id',job.id,'transmission_id',transmission,'status',job.status,'reused',false);
end $$;

create or replace function public.einvoice_claim_jobs(p_worker text,p_limit integer default 10,p_organization_id uuid default null,p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare job public.einvoice_jobs%rowtype;candidate record;locked_doc public.einvoice_documents%rowtype;result jsonb:='[]'::jsonb;token uuid;
begin
 if nullif(btrim(p_worker),'') is null or length(p_worker)>100 or p_limit not between 1 and 50 then raise exception 'EINVOICE_INVALID_WORKER' using errcode='22023';end if;
 -- A crash during the third lease must become a visible terminal failure,
 -- rather than an eternally running row that prevents future submissions.
 for candidate in select j.id,j.document_id,j.organization_id from public.einvoice_jobs j join public.einvoice_settings s on s.organization_id=j.organization_id and s.enabled and s.connector_mode='simulation'
  where j.status='running' and j.attempts>=3 and j.lease_expires_at<=clock_timestamp() and (p_organization_id is null or j.organization_id=p_organization_id) and (p_job_id is null or j.id=p_job_id) order by j.id limit p_limit loop
  select * into locked_doc from public.einvoice_documents where id=candidate.document_id and organization_id=candidate.organization_id for update skip locked;
  if not found then continue;end if;
  select * into job from public.einvoice_jobs where id=candidate.id and status='running' and attempts>=3 and lease_expires_at<=clock_timestamp() for update skip locked;
  if not found then continue;end if;
  update public.einvoice_jobs set status='failed',error_code='LEASE_ATTEMPTS_EXHAUSTED',completed_at=now(),updated_at=now() where id=job.id;
  update public.einvoice_transmissions set status='unknown',error_code='LEASE_ATTEMPTS_EXHAUSTED',updated_at=now() where id=job.transmission_id and organization_id=job.organization_id;
  update public.einvoice_documents set simulation_status='unknown',updated_at=now() where id=job.document_id and organization_id=job.organization_id;
  perform app_private.einvoice_append_event(job.created_by,job.organization_id,job.document_id,'simulation.lease_exhausted','error',jsonb_build_object('attempts',job.attempts,'simulation',true));
 end loop;
 -- Follow the same document -> job lock order as finish/enqueue. Locking the
 -- job cursor first can deadlock a finisher that already holds its document.
 for candidate in select j.id,j.document_id,j.organization_id from public.einvoice_jobs j join public.einvoice_settings s on s.organization_id=j.organization_id and s.enabled and s.connector_mode='simulation'
  where (p_organization_id is null or j.organization_id=p_organization_id) and (p_job_id is null or j.id=p_job_id) and j.attempts<3
   and ((j.status in('queued','retry_wait') and j.available_at<=clock_timestamp()) or (j.status='running' and j.lease_expires_at<=clock_timestamp()))
  order by j.available_at,j.id limit p_limit loop
  select * into locked_doc from public.einvoice_documents where id=candidate.document_id and organization_id=candidate.organization_id for update skip locked;
  if not found then continue;end if;
  select * into job from public.einvoice_jobs where id=candidate.id and organization_id=candidate.organization_id and attempts<3
   and ((status in('queued','retry_wait') and available_at<=clock_timestamp()) or (status='running' and lease_expires_at<=clock_timestamp())) for update skip locked;
  if not found then continue;end if;
  begin
   perform app_private.einvoice_assert_actor(job.created_by,job.organization_id,true,true);
  exception when insufficient_privilege then
   -- An expired subscription is a reversible pause. A removed administrator
   -- cannot retain an open job forever and block a current administrator.
   if sqlerrm='SUBSCRIPTION_WRITE_REQUIRED' then continue;end if;
   if sqlerrm not in('EINVOICE_ACCESS_DENIED','EINVOICE_ADMIN_REQUIRED','EINVOICE_WRITE_REQUIRED','EINVOICE_AUTH_REQUIRED') then raise;end if;
   update public.einvoice_jobs set status='failed',error_code='ACTOR_AUTHORIZATION_REVOKED',completed_at=now(),updated_at=now() where id=job.id;
   update public.einvoice_transmissions set status='unknown',error_code='ACTOR_AUTHORIZATION_REVOKED',updated_at=now() where id=job.transmission_id and organization_id=job.organization_id;
   update public.einvoice_documents set simulation_status='unknown',updated_at=now() where id=job.document_id and organization_id=job.organization_id;
   perform app_private.einvoice_append_event(null,job.organization_id,job.document_id,'simulation.actor_authorization_revoked','warning',jsonb_build_object('original_actor_id',job.created_by,'attempts',job.attempts,'simulation',true,'error_code','ACTOR_AUTHORIZATION_REVOKED'));
   continue;
  end;
  token:=gen_random_uuid();
  update public.einvoice_jobs set status='running',attempts=attempts+1,lease_token=token,lease_expires_at=clock_timestamp()+interval '2 minutes',worker=p_worker,finish_hash=null,updated_at=now() where id=job.id returning * into job;
  update public.einvoice_transmissions set status='pending',updated_at=now() where id=job.transmission_id and organization_id=job.organization_id;
  result:=result||jsonb_build_array(jsonb_build_object('job_id',job.id,'organization_id',job.organization_id,'document_id',job.document_id,'version_id',job.version_id,'transmission_id',job.transmission_id,'scenario',job.scenario,'attempts',job.attempts,'lease_token',token,'lease_expires_at',job.lease_expires_at));
 end loop;
 return result;
end $$;

-- Filter tenant rollout settings, entitlement and an optional server allowlist
-- before limiting the batch, so inactive or unrelated tenants cannot starve it.
create or replace function public.einvoice_due_organizations(p_organization_ids uuid[] default null,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'EINVOICE_INVALID_WORKER' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('organization_id',due.organization_id) order by due.first_due,due.organization_id),'[]'::jsonb) into result
 from (
  select j.organization_id,min(case when j.status='running' then j.lease_expires_at else j.available_at end) first_due
  from public.einvoice_jobs j
  join public.einvoice_settings s on s.organization_id=j.organization_id and s.enabled and s.connector_mode='simulation'
  join lateral(select status,coalesce(trial_ends_at,trial_end) trial_end,current_period_end from public.organization_subscriptions where organization_id=j.organization_id order by created_at desc limit 1) sub on true
  where (p_organization_ids is null or j.organization_id=any(p_organization_ids))
   and coalesce((sub.status in('trialing','trial') and sub.trial_end>clock_timestamp()) or (sub.status='active' and sub.current_period_end>clock_timestamp()),false)
   and ((j.status in('queued','retry_wait') and j.available_at<=clock_timestamp()) or (j.status='running' and j.lease_expires_at<=clock_timestamp()))
  group by j.organization_id order by first_due,j.organization_id limit p_limit
 ) due;
 return result;
end $$;

create or replace function public.einvoice_finish_job(p_job_id uuid,p_lease_token uuid,p_outcome text,p_acknowledgement jsonb default '{}'::jsonb,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare job public.einvoice_jobs%rowtype;doc public.einvoice_documents%rowtype;terminal boolean;job_status text;transmission_status text;completion_hash text;
begin
 select * into job from public.einvoice_jobs where id=p_job_id;
 if not found then raise exception 'EINVOICE_JOB_NOT_FOUND' using errcode='42501';end if;
 select * into doc from public.einvoice_documents where id=job.document_id and organization_id=job.organization_id for update;
 select * into job from public.einvoice_jobs where id=p_job_id for update;
 if p_outcome is null or p_outcome not in('accepted','rejected','timeout','unavailable') then raise exception 'EINVOICE_INVALID_OUTCOME' using errcode='22023';end if;
 perform app_private.einvoice_safe_metadata(p_acknowledgement);
 completion_hash:=encode(sha256(convert_to(jsonb_build_array(p_outcome,p_acknowledgement,p_error_code)::text,'UTF8')),'hex');
 if job.finish_hash is not null and job.lease_token=p_lease_token then
  if job.finish_hash<>completion_hash then raise exception 'EINVOICE_IDEMPOTENCY_CONFLICT' using errcode='23514';end if;
  return jsonb_build_object('job_id',job.id,'status',job.status,'attempts',job.attempts,'reused',true);
 end if;
 if job.status<>'running' or job.lease_token is distinct from p_lease_token or job.lease_expires_at<=clock_timestamp() then raise exception 'EINVOICE_STALE_LEASE' using errcode='40001';end if;
 if p_outcome is null or p_outcome not in('accepted','rejected','timeout','unavailable') then raise exception 'EINVOICE_INVALID_OUTCOME' using errcode='22023';end if;
 if not exists(select 1 from public.einvoice_settings where organization_id=job.organization_id and enabled and connector_mode='simulation') then raise exception 'EINVOICE_SIMULATION_DISABLED' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(job.created_by,job.organization_id,true,true);
 if doc.status<>'ready_to_submit' or doc.current_version_id<>job.version_id then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 perform app_private.einvoice_safe_metadata(p_acknowledgement);
 if length(coalesce(p_error_code,''))>150 then raise exception 'EINVOICE_INVALID_ERROR_CODE' using errcode='22023';end if;
 terminal:=p_outcome in('accepted','rejected') or job.attempts>=3;
 job_status:=case when p_outcome='accepted' then 'succeeded' when terminal then 'failed' else 'retry_wait' end;
 transmission_status:=case when p_outcome='accepted' then 'accepted' when p_outcome='rejected' then 'rejected' else 'unknown' end;
 update public.einvoice_jobs set status=job_status,available_at=case when terminal then available_at else clock_timestamp()+interval '30 seconds'*power(2,job.attempts-1) end,error_code=p_error_code,finish_hash=completion_hash,completed_at=case when terminal then now() else null end,updated_at=now() where id=job.id;
 update public.einvoice_transmissions set status=transmission_status,acknowledgement=p_acknowledgement,acknowledgement_sha256=encode(sha256(convert_to(p_acknowledgement::text,'UTF8')),'hex'),error_code=p_error_code,updated_at=now() where id=job.transmission_id and organization_id=job.organization_id;
 update public.einvoice_documents set simulation_status=transmission_status,updated_at=now() where id=doc.id;
 perform app_private.einvoice_append_event(job.created_by,job.organization_id,doc.id,'simulation.'||p_outcome,case when p_outcome='accepted' then 'info' when p_outcome='rejected' then 'warning' else 'error' end,jsonb_build_object('attempts',job.attempts,'retry',not terminal,'simulation',true,'error_code',p_error_code));
 return jsonb_build_object('job_id',job.id,'transmission_id',job.transmission_id,'status',job_status,'simulation_status',transmission_status,'attempts',job.attempts,'reused',false);
end $$;

create or replace function public.einvoice_audit_append(p_actor uuid,p_organization_id uuid,p_document_id uuid,p_event text,p_severity text default 'info',p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,app_private as $$
begin
 perform app_private.einvoice_assert_actor(p_actor,p_organization_id,p_document_id is null,false);
 return app_private.einvoice_append_event(p_actor,p_organization_id,p_document_id,p_event,p_severity,p_metadata);
end $$;

create or replace function app_private.einvoice_guard_issued_source()
returns trigger language plpgsql security definer set search_path=public,app_private as $$
declare kind text:=case when tg_table_name='customer_invoices' then 'invoice' else 'credit_note' end;
begin
 if exists(select 1 from public.einvoice_documents where source_kind=kind and source_id=old.id and organization_id=old.organization_id and issued_at is not null) then
  if tg_op='DELETE' then raise exception 'EINVOICE_ISSUED_SOURCE_READ_ONLY' using errcode='42501';end if;
  if new.notes is distinct from old.notes or new.status='cancelled' or new.archived_at is distinct from old.archived_at then raise exception 'EINVOICE_ISSUED_SOURCE_READ_ONLY' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function app_private.einvoice_guard_issued_source() from public,anon,authenticated;
drop trigger if exists einvoice_issued_source on public.customer_invoices;
create trigger einvoice_issued_source before update or delete on public.customer_invoices for each row execute function app_private.einvoice_guard_issued_source();
drop trigger if exists einvoice_issued_source on public.customer_credit_notes;
create trigger einvoice_issued_source before update or delete on public.customer_credit_notes for each row execute function app_private.einvoice_guard_issued_source();

revoke all on function public.einvoice_capture_source(text,uuid),public.einvoice_update_settings(uuid,boolean,text,jsonb,integer),public.einvoice_transition(uuid,integer,text),public.einvoice_get_artifact(uuid),public.einvoice_enqueue_simulation(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.einvoice_capture_source(text,uuid),public.einvoice_update_settings(uuid,boolean,text,jsonb,integer),public.einvoice_transition(uuid,integer,text),public.einvoice_get_artifact(uuid),public.einvoice_enqueue_simulation(uuid,integer,text,uuid) to authenticated;
revoke all on function public.einvoice_save_preparation(uuid,text,uuid,text,jsonb,text,jsonb,jsonb,text,integer,uuid),public.einvoice_claim_jobs(text,integer,uuid,uuid),public.einvoice_due_organizations(uuid[],integer),public.einvoice_finish_job(uuid,uuid,text,jsonb,text),public.einvoice_audit_append(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.einvoice_save_preparation(uuid,text,uuid,text,jsonb,text,jsonb,jsonb,text,integer,uuid),public.einvoice_claim_jobs(text,integer,uuid,uuid),public.einvoice_due_organizations(uuid[],integer),public.einvoice_finish_job(uuid,uuid,text,jsonb,text),public.einvoice_audit_append(uuid,uuid,uuid,text,text,jsonb) to service_role;
  grant select on public.einvoice_settings,public.einvoice_documents,public.einvoice_versions,public.einvoice_artifacts,public.einvoice_validations,public.einvoice_transmissions,public.einvoice_jobs,public.einvoice_events to service_role;
 end if;
end $$;

create or replace view public.einvoice_source_index with(security_invoker=true) as
 select 'invoice:'||i.id::text as id,i.organization_id,'invoice'::text as source_kind,i.id as source_id,i.invoice_number as number,i.invoice_date as issue_date,t.name as buyer_name,i.currency,i.total_ttc::text as total_ttc,i.status as source_status,i.archived_at
 from public.customer_invoices i left join public.third_parties t on t.id=i.customer_id and t.organization_id=i.organization_id
 union all
 select 'credit_note:'||c.id::text,c.organization_id,'credit_note'::text,c.id,c.credit_note_number,c.credit_note_date,t.name,c.currency,c.total_ttc::text,c.status,c.archived_at
 from public.customer_credit_notes c left join public.third_parties t on t.id=c.customer_id and t.organization_id=c.organization_id;
revoke all on public.einvoice_source_index from public,anon;
grant select on public.einvoice_source_index to authenticated;

select to_regprocedure('public.einvoice_capture_source(text,uuid)') is not null and to_regprocedure('public.einvoice_save_preparation(uuid,text,uuid,text,jsonb,text,jsonb,jsonb,text,integer,uuid)') is not null
 and exists(select 1 from pg_policies where tablename='einvoice_artifacts' and policyname='einvoice_tenant_read')
 and not has_function_privilege('authenticated','public.einvoice_save_preparation(uuid,text,uuid,text,jsonb,text,jsonb,jsonb,text,integer,uuid)','execute') as facturation_electronique_102_active;

-- Source: 103_electronic_invoicing_operations.sql
-- SHA256: f82118ea8aaf2b6cf49f94906c1884d2d4ad3ae37d0b7e45ae8f252076ae59b8
-- Operational document flow: validate and issue the existing prepared version
-- atomically. This does not submit to DGI, sign, renumber or account a source.

create or replace function public.einvoice_issue_and_archive(p_document_id uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare doc public.einvoice_documents%rowtype; result jsonb;
begin
 select * into doc from public.einvoice_documents where id=p_document_id;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(auth.uid(),doc.organization_id,false,true);
 perform pg_advisory_xact_lock(hashtextextended('einvoice-source:'||doc.organization_id::text||':'||doc.source_kind||':'||doc.source_id::text,0));
 select * into doc from public.einvoice_documents where id=p_document_id and organization_id=doc.organization_id for update;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 if p_expected_version is distinct from doc.current_version_number then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 if not exists(select 1 from public.einvoice_settings where organization_id=doc.organization_id and enabled) then raise exception 'EINVOICE_MODULE_DISABLED' using errcode='42501';end if;
 if doc.status in('issued','ready_to_submit') and doc.issued_at is not null then
  return jsonb_build_object('document_id',doc.id,'version_id',doc.current_version_id,'version_number',doc.current_version_number,'status',doc.status,'reused',true);
 end if;
 if doc.status not in('draft','validated') then raise exception 'EINVOICE_INVALID_TRANSITION' using errcode='23514';end if;
 if doc.status='draft' then perform public.einvoice_transition(p_document_id,p_expected_version,'validated');end if;
 result:=public.einvoice_transition(p_document_id,p_expected_version,'issued');
 return result;
end $$;

-- Supabase can grant service_role EXECUTE explicitly through default privileges.
-- Revoking PUBLIC alone does not remove that inherited-at-creation grant.
revoke all on function public.einvoice_issue_and_archive(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.einvoice_issue_and_archive(uuid,integer) to authenticated;

-- Readiness metadata is tenant-authenticated and read-only, including for
-- subscribers with archive-only access. It grants no document mutation.
create or replace function public.einvoice_get_capabilities(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,app_private as $$
begin
 perform app_private.einvoice_assert_actor(auth.uid(),p_organization_id,false,false);
 return jsonb_build_object('workflow_version',2,'atomic_issuance',true);
end $$;

revoke all on function public.einvoice_get_capabilities(uuid) from public,anon,authenticated,service_role;
grant execute on function public.einvoice_get_capabilities(uuid) to authenticated;

select to_regprocedure('public.einvoice_issue_and_archive(uuid,integer)') is not null
 and to_regprocedure('public.einvoice_get_capabilities(uuid)') is not null as facturation_operations_103_active;

select to_regclass('public.einvoice_settings') is not null as facturation_electronique_102_active,
 to_regprocedure('public.einvoice_issue_and_archive(uuid,integer)') is not null
 and to_regprocedure('public.einvoice_get_capabilities(uuid)') is not null as facturation_operations_103_active;
commit;
