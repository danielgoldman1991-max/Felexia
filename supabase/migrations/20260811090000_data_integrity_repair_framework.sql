-- Tenant-scoped, logged and transactional repair framework.
-- No historical data is changed when this migration is applied.

create table if not exists public.data_repair_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repair_key text not null,
  mode text not null check (mode in ('dry_run', 'apply')),
  status text not null check (status in ('running', 'completed', 'failed')),
  scopes text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  requested_by uuid null references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.data_repair_runs enable row level security;
revoke all on table public.data_repair_runs from public, anon, authenticated;
grant select, insert, update on table public.data_repair_runs to service_role;

create index if not exists data_repair_runs_org_started_idx
  on public.data_repair_runs (organization_id, started_at desc);

create or replace function public.repair_erp_integrity(
  p_organization_id uuid,
  p_dry_run boolean default true,
  p_scopes text[] default array['payments', 'treasury', 'accounting']::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_mode text := case when p_dry_run then 'dry_run' else 'apply' end;
  v_invalid_scopes text[];
  v_payment_candidates integer := 0;
  v_treasury_candidates integer := 0;
  v_accounting_candidates integer := 0;
  v_document_candidates integer := 0;
  v_summary jsonb;
  v_record_id uuid;
begin
  if p_organization_id is null or not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'Organisation de réparation introuvable.';
  end if;

  if p_scopes is null or cardinality(p_scopes) = 0 then
    raise exception 'Au moins un scope de reparation est obligatoire.';
  end if;

  select coalesce(array_agg(scope), '{}'::text[]) into v_invalid_scopes
  from unnest(p_scopes) scope
  where scope not in ('payments', 'treasury', 'accounting', 'document_headers');
  if cardinality(v_invalid_scopes) > 0 then
    raise exception 'Scopes de réparation non autorisés : %', v_invalid_scopes;
  end if;

  insert into public.data_repair_runs (
    organization_id, repair_key, mode, status, scopes, requested_by
  ) values (
    p_organization_id, 'erp_integrity_v1', v_mode, 'running', p_scopes, auth.uid()
  ) returning id into v_run_id;

  begin
    if 'payments' = any(p_scopes) then
      select
        (select count(*) from public.customer_invoices invoice
         left join lateral (
           select coalesce(sum(allocation.amount), 0)::numeric(14,2) paid
           from public.customer_payment_allocations allocation
           join public.customer_payments payment on payment.id = allocation.payment_id
           where allocation.invoice_id = invoice.id
             and allocation.cancelled_at is null
             and payment.archived_at is null
             and payment.status in ('confirmed', 'partially_allocated', 'allocated')
         ) totals on true
         where invoice.organization_id = p_organization_id
           and invoice.archived_at is null
           and (
             abs(invoice.paid_amount - least(totals.paid, greatest(invoice.total_ttc - coalesce(invoice.credit_amount, 0), 0))) > 0.01
             or abs(invoice.remaining_amount - greatest(invoice.total_ttc - totals.paid - coalesce(invoice.credit_amount, 0), 0)) > 0.01
           ))
        +
        (select count(*) from public.supplier_invoices invoice
         left join lateral (
           select coalesce(sum(allocation.amount), 0)::numeric(14,2) paid
           from public.supplier_payment_allocations allocation
           join public.supplier_payments payment on payment.id = allocation.payment_id
           where allocation.invoice_id = invoice.id
             and allocation.cancelled_at is null
             and payment.archived_at is null
             and payment.status in ('confirmed', 'partially_allocated', 'allocated')
         ) totals on true
         where invoice.organization_id = p_organization_id
           and invoice.archived_at is null
           and (
             abs(invoice.paid_amount - least(totals.paid, invoice.total_ttc)) > 0.01
             or abs(invoice.remaining_amount - greatest(invoice.total_ttc - totals.paid, 0)) > 0.01
           ))
      into v_payment_candidates;
    end if;

    if 'treasury' = any(p_scopes) then
      select count(*) into v_treasury_candidates
      from public.treasury_accounts account
      left join lateral (
        select coalesce(sum(case when movement_row.direction = 'out' then -movement_row.amount else movement_row.amount end), 0) movement
        from public.treasury_transactions movement_row
        where movement_row.organization_id = account.organization_id
          and movement_row.treasury_account_id = account.id
          and movement_row.archived_at is null
          and movement_row.transaction_type <> 'opening_balance'
      ) totals on true
      where account.organization_id = p_organization_id
        and account.archived_at is null
        and abs(account.current_balance - (account.opening_balance + totals.movement)) > 0.01;
    end if;

    if 'accounting' = any(p_scopes) then
      select
        (select count(*)
         from public.accounting_entries entry
         join public.customer_invoices invoice
           on entry.source_document_type = 'customer_invoice'
          and entry.source_document_id = invoice.id
          and entry.organization_id = invoice.organization_id
         where entry.organization_id = p_organization_id
           and entry.status = 'posted'
           and invoice.discount_total > 0
           and invoice.total_ttc > entry.total_debit
           and abs((invoice.total_ttc - entry.total_debit) - invoice.discount_total) <= 0.02
           and abs(entry.total_debit - entry.total_credit) <= 0.01
           and exists (
             select 1 from public.accounting_entry_lines line
             where line.entry_id = entry.id and line.debit > 0 and line.account_code like '342%'
           )
           and exists (
             select 1 from public.accounting_entry_lines line
             where line.entry_id = entry.id and line.credit > 0 and line.account_code like '7%'
           ))
        +
        (select count(*)
         from public.accounting_entries entry
         join public.supplier_invoices invoice
           on entry.source_document_type = 'supplier_invoice'
          and entry.source_document_id = invoice.id
          and entry.organization_id = invoice.organization_id
         where entry.organization_id = p_organization_id
           and entry.status = 'posted'
           and invoice.discount_total > 0
           and invoice.total_ttc > entry.total_credit
           and abs((invoice.total_ttc - entry.total_credit) - invoice.discount_total) <= 0.02
           and abs(entry.total_debit - entry.total_credit) <= 0.01
           and exists (
             select 1 from public.accounting_entry_lines line
             where line.entry_id = entry.id and line.credit > 0 and line.account_code like '441%'
           )
           and exists (
             select 1 from public.accounting_entry_lines line
             where line.entry_id = entry.id and line.debit > 0 and line.account_code like '6%'
           ))
      into v_accounting_candidates;
    end if;

    if 'document_headers' = any(p_scopes) then
      select
        (select count(*) from public.customer_invoices header join (
          select invoice_id, sum(subtotal_ht) subtotal_ht, sum(discount_amount) discount_total, sum(tax_amount) tax_total, sum(total_ttc) total_ttc
          from public.customer_invoice_lines where organization_id = p_organization_id group by invoice_id
        ) totals on totals.invoice_id = header.id
        where header.organization_id = p_organization_id and (header.subtotal_ht, header.discount_total, header.tax_total, header.total_ttc)
          is distinct from (totals.subtotal_ht, totals.discount_total, totals.tax_total, totals.total_ttc))
        +
        (select count(*) from public.supplier_invoices header join (
          select invoice_id, sum(subtotal_ht) subtotal_ht, sum(discount_amount) discount_total, sum(tax_amount) tax_total, sum(total_ttc) total_ttc
          from public.supplier_invoice_lines where organization_id = p_organization_id group by invoice_id
        ) totals on totals.invoice_id = header.id
        where header.organization_id = p_organization_id and (header.subtotal_ht, header.discount_total, header.tax_total, header.total_ttc)
          is distinct from (totals.subtotal_ht, totals.discount_total, totals.tax_total, totals.total_ttc))
      into v_document_candidates;
    end if;

    v_summary := jsonb_build_object(
      'payment_candidates', v_payment_candidates,
      'treasury_candidates', v_treasury_candidates,
      'accounting_candidates', v_accounting_candidates,
      'document_header_candidates', v_document_candidates
    );

    if not p_dry_run then
      if 'payments' = any(p_scopes) then
        for v_record_id in select id from public.customer_payments where organization_id = p_organization_id loop
          perform public.sync_customer_payment_totals(v_record_id);
        end loop;
        for v_record_id in select id from public.customer_invoices where organization_id = p_organization_id loop
          perform public.sync_customer_invoice_payment_totals(v_record_id);
        end loop;
        for v_record_id in select id from public.supplier_payments where organization_id = p_organization_id loop
          perform public.sync_supplier_payment_totals(v_record_id);
        end loop;
        for v_record_id in select id from public.supplier_invoices where organization_id = p_organization_id loop
          perform public.sync_supplier_invoice_payment_totals(v_record_id);
        end loop;
      end if;

      if 'treasury' = any(p_scopes) then
        update public.treasury_accounts account
        set current_balance = account.opening_balance + totals.movement,
            updated_at = now()
        from (
          select treasury_account_id,
            coalesce(sum(case when direction = 'out' then -amount else amount end), 0)::numeric(14,2) movement
          from public.treasury_transactions
          where organization_id = p_organization_id
            and archived_at is null
            and transaction_type <> 'opening_balance'
          group by treasury_account_id
        ) totals
        where account.organization_id = p_organization_id
          and account.id = totals.treasury_account_id
          and abs(account.current_balance - (account.opening_balance + totals.movement)) > 0.01;

        update public.treasury_accounts account
        set current_balance = account.opening_balance, updated_at = now()
        where account.organization_id = p_organization_id
          and account.archived_at is null
          and not exists (
            select 1 from public.treasury_transactions movement_row
            where movement_row.treasury_account_id = account.id
              and movement_row.archived_at is null
              and movement_row.transaction_type <> 'opening_balance'
          )
          and abs(account.current_balance - account.opening_balance) > 0.01;
      end if;

      if 'accounting' = any(p_scopes) then
        with candidates as (
          select entry.id entry_id, round(invoice.total_ttc - entry.total_debit, 2) delta
          from public.accounting_entries entry
          join public.customer_invoices invoice
            on entry.source_document_type = 'customer_invoice'
           and entry.source_document_id = invoice.id
           and entry.organization_id = invoice.organization_id
          where entry.organization_id = p_organization_id
            and entry.status = 'posted'
            and invoice.discount_total > 0
            and invoice.total_ttc > entry.total_debit
            and abs((invoice.total_ttc - entry.total_debit) - invoice.discount_total) <= 0.02
            and abs(entry.total_debit - entry.total_credit) <= 0.01
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.debit > 0 and target.account_code like '342%'
            )
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.credit > 0 and target.account_code like '7%'
            )
        ), customer_lines as (
          select distinct on (line.entry_id) line.id, candidates.delta
          from public.accounting_entry_lines line join candidates on candidates.entry_id = line.entry_id
          where line.debit > 0 and line.account_code like '342%'
          order by line.entry_id, line.line_number
        )
        update public.accounting_entry_lines line
        set debit = line.debit + customer_lines.delta
        from customer_lines where line.id = customer_lines.id;

        with candidates as (
          select entry.id entry_id, round(invoice.total_ttc - entry.total_credit, 2) delta
          from public.accounting_entries entry
          join public.customer_invoices invoice
            on entry.source_document_type = 'customer_invoice'
           and entry.source_document_id = invoice.id
           and entry.organization_id = invoice.organization_id
          where entry.organization_id = p_organization_id
            and entry.status = 'posted'
            and invoice.discount_total > 0
            and invoice.total_ttc > entry.total_credit
            and abs((invoice.total_ttc - entry.total_credit) - invoice.discount_total) <= 0.02
            and abs(entry.total_debit - entry.total_credit) <= 0.01
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.debit > 0 and target.account_code like '342%'
            )
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.credit > 0 and target.account_code like '7%'
            )
        ), revenue_lines as (
          select distinct on (line.entry_id) line.id, candidates.delta
          from public.accounting_entry_lines line join candidates on candidates.entry_id = line.entry_id
          where line.credit > 0 and line.account_code like '7%'
          order by line.entry_id, line.line_number
        )
        update public.accounting_entry_lines line
        set credit = line.credit + revenue_lines.delta
        from revenue_lines where line.id = revenue_lines.id;

        with candidates as (
          select entry.id entry_id, round(invoice.total_ttc - entry.total_credit, 2) delta
          from public.accounting_entries entry
          join public.supplier_invoices invoice
            on entry.source_document_type = 'supplier_invoice'
           and entry.source_document_id = invoice.id
           and entry.organization_id = invoice.organization_id
          where entry.organization_id = p_organization_id
            and entry.status = 'posted'
            and invoice.discount_total > 0
            and invoice.total_ttc > entry.total_credit
            and abs((invoice.total_ttc - entry.total_credit) - invoice.discount_total) <= 0.02
            and abs(entry.total_debit - entry.total_credit) <= 0.01
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.credit > 0 and target.account_code like '441%'
            )
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.debit > 0 and target.account_code like '6%'
            )
        ), supplier_lines as (
          select distinct on (line.entry_id) line.id, candidates.delta
          from public.accounting_entry_lines line join candidates on candidates.entry_id = line.entry_id
          where line.credit > 0 and line.account_code like '441%'
          order by line.entry_id, line.line_number
        )
        update public.accounting_entry_lines line
        set credit = line.credit + supplier_lines.delta
        from supplier_lines where line.id = supplier_lines.id;

        with candidates as (
          select entry.id entry_id, round(invoice.total_ttc - entry.total_debit, 2) delta
          from public.accounting_entries entry
          join public.supplier_invoices invoice
            on entry.source_document_type = 'supplier_invoice'
           and entry.source_document_id = invoice.id
           and entry.organization_id = invoice.organization_id
          where entry.organization_id = p_organization_id
            and entry.status = 'posted'
            and invoice.discount_total > 0
            and invoice.total_ttc > entry.total_debit
            and abs((invoice.total_ttc - entry.total_debit) - invoice.discount_total) <= 0.02
            and abs(entry.total_debit - entry.total_credit) <= 0.01
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.credit > 0 and target.account_code like '441%'
            )
            and exists (
              select 1 from public.accounting_entry_lines target
              where target.entry_id = entry.id and target.debit > 0 and target.account_code like '6%'
            )
        ), purchase_lines as (
          select distinct on (line.entry_id) line.id, candidates.delta
          from public.accounting_entry_lines line join candidates on candidates.entry_id = line.entry_id
          where line.debit > 0 and line.account_code like '6%'
          order by line.entry_id, line.line_number
        )
        update public.accounting_entry_lines line
        set debit = line.debit + purchase_lines.delta
        from purchase_lines where line.id = purchase_lines.id;

        update public.accounting_entries entry
        set total_debit = totals.total_debit, total_credit = totals.total_credit, updated_at = now()
        from (
          select entry_id, sum(debit)::numeric(14,2) total_debit, sum(credit)::numeric(14,2) total_credit
          from public.accounting_entry_lines
          where organization_id = p_organization_id
          group by entry_id
        ) totals
        where entry.id = totals.entry_id and entry.organization_id = p_organization_id
          and (entry.total_debit, entry.total_credit) is distinct from (totals.total_debit, totals.total_credit);
      end if;

      if 'document_headers' = any(p_scopes) then
        update public.customer_invoices header set
          subtotal_ht = totals.subtotal_ht, discount_total = totals.discount_total,
          tax_total = totals.tax_total, total_ttc = totals.total_ttc, updated_at = now()
        from (
          select invoice_id, sum(subtotal_ht)::numeric(14,2) subtotal_ht,
            sum(discount_amount)::numeric(14,2) discount_total,
            sum(tax_amount)::numeric(14,2) tax_total, sum(total_ttc)::numeric(14,2) total_ttc
          from public.customer_invoice_lines where organization_id = p_organization_id group by invoice_id
        ) totals
        where header.organization_id = p_organization_id and header.id = totals.invoice_id;

        update public.supplier_invoices header set
          subtotal_ht = totals.subtotal_ht, discount_total = totals.discount_total,
          tax_total = totals.tax_total, total_ttc = totals.total_ttc, updated_at = now()
        from (
          select invoice_id, sum(subtotal_ht)::numeric(14,2) subtotal_ht,
            sum(discount_amount)::numeric(14,2) discount_total,
            sum(tax_amount)::numeric(14,2) tax_total, sum(total_ttc)::numeric(14,2) total_ttc
          from public.supplier_invoice_lines where organization_id = p_organization_id group by invoice_id
        ) totals
        where header.organization_id = p_organization_id and header.id = totals.invoice_id;
      end if;
    end if;

    update public.data_repair_runs
    set status = 'completed', summary = v_summary, completed_at = now()
    where id = v_run_id;
  exception when others then
    update public.data_repair_runs
    set status = 'failed', error_message = sqlerrm, completed_at = now()
    where id = v_run_id;
    return jsonb_build_object(
      'run_id', v_run_id, 'mode', v_mode, 'status', 'failed', 'error', sqlerrm
    );
  end;

  return jsonb_build_object(
    'run_id', v_run_id, 'mode', v_mode, 'status', 'completed', 'summary', v_summary
  );
end;
$$;

revoke all on function public.repair_erp_integrity(uuid, boolean, text[]) from public, anon, authenticated;
grant execute on function public.repair_erp_integrity(uuid, boolean, text[]) to service_role;
