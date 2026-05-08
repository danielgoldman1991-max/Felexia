-- Seed data for Commerce module (migration 004 columns)
-- Run after migrations 001-004 and seed.sql
-- Adds contacts, updates existing commerce records with new columns,
-- and creates complete quote -> order -> delivery flows

do $$
declare
  v_org_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_tp_atlas uuid := '40000000-0000-0000-0000-000000000001'::uuid;
  v_tp_nova uuid := '40000000-0000-0000-0000-000000000002'::uuid;
  v_prod_lenovo uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_prod_toner uuid := '50000000-0000-0000-0000-000000000002'::uuid;
  v_prod_maint uuid := '50000000-0000-0000-0000-000000000003'::uuid;
  v_unit_u uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  v_unit_mois uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_tva_20 uuid := '10000000-0000-0000-0000-000000000020'::uuid;
  v_dev1_id uuid := '70000000-0000-0000-0000-000000000001'::uuid;
  v_dev2_id uuid := '70000000-0000-0000-0000-000000000002'::uuid;
  v_contact_atlas uuid := '80000000-0000-0000-0000-000000000001'::uuid;
  v_contact_nova uuid := '80000000-0000-0000-0000-000000000002'::uuid;
  v_dev3_id uuid := '70000000-0000-0000-0000-000000000003'::uuid;
  v_cmd1_id uuid := '72000000-0000-0000-0000-000000000001'::uuid;
  v_bl1_id uuid := '73000000-0000-0000-0000-000000000001'::uuid;
begin
  -- =============================================
  -- CONTACTS (for sales_quotes/sales_orders/delivery_notes.contact_id)
  -- =============================================
  insert into contacts (id, organization_id, third_party_id, full_name, email, phone, is_primary)
  values (v_contact_atlas, v_org_id, v_tp_atlas, 'Karim Idrissi', 'karim@atlas-market.ma', '+212522314421', true)
  on conflict (id) do nothing;

  insert into contacts (id, organization_id, third_party_id, full_name, email, phone, is_primary)
  values (v_contact_nova, v_org_id, v_tp_nova, 'Hind Benali', 'hind@nova-industries.ma', '+212539611289', true)
  on conflict (id) do nothing;

  -- =============================================
  -- UPDATE EXISTING QUOTES with new columns
  -- =============================================
  update sales_quotes
  set contact_id = v_contact_atlas,
      subtotal_ht = 34500,
      total_ttc = 41400,
      discount_total = 0,
      payment_terms_days = 30
  where id = v_dev1_id;

  update sales_quotes
  set contact_id = v_contact_nova,
      subtotal_ht = 15500,
      total_ttc = 18600,
      discount_total = 0,
      payment_terms_days = 45
  where id = v_dev2_id;

  -- =============================================
  -- ADD QUOTE LINES for existing quotes (new columns)
  -- =============================================
  insert into sales_quote_lines (organization_id, quote_id, product_id, description, quantity, unit_price, tax_rate, line_total,
    unit_id, unit_price_ht, discount_rate, tax_rate_id, tax_amount, subtotal_ht, total_ttc, line_order)
  values
    (v_org_id, v_dev1_id, v_prod_lenovo, 'PC portable Lenovo 14 pouces', 3, 7200, 20, 25920,
     v_unit_u, 7200, 0, v_tva_20, 4320, 21600, 25920, 1),
    (v_org_id, v_dev1_id, v_prod_toner, 'Toner HP 85A compatible', 10, 240, 20, 2880,
     v_unit_u, 240, 0, v_tva_20, 480, 2400, 2880, 2),
    (v_org_id, v_dev1_id, v_prod_maint, 'Maintenance mensuelle parc informatique', 3, 3500, 20, 12600,
     v_unit_mois, 3500, 0, v_tva_20, 2100, 10500, 12600, 3);

  -- =============================================
  -- SALES ORDERS with new columns
  -- =============================================
  insert into sales_orders (id, organization_id, number, third_party_id, contact_id, document_date, due_date, status,
    quote_id, subtotal, tax_total, total, subtotal_ht, total_ttc, discount_total, delivered_total, expected_delivery_date,
    payment_terms_days, internal_notes)
  values (v_cmd1_id, v_org_id, 'CMD-2026-0001', v_tp_nova, v_contact_nova,
    '2026-05-07', '2026-06-06', 'confirmed',
    v_dev2_id, 18240, 3040, 21280, 15200, 18240, 0, 0, '2026-05-21',
    45, 'Commande confirmee suite devis DEV-2026-0002')
  on conflict (id) do nothing;

  insert into sales_order_lines (organization_id, order_id, product_id, description, quantity, unit_price, tax_rate, line_total,
    quote_line_id, unit_id, unit_price_ht, discount_rate, tax_rate_id, tax_amount, delivered_quantity, subtotal_ht, total_ttc, line_order)
  select
    v_org_id, v_cmd1_id, product_id, description, quantity, unit_price, tax_rate, line_total,
    id, unit_id, unit_price_ht, discount_rate, tax_rate_id, tax_amount, 0, subtotal_ht, total_ttc, line_order
  from sales_quote_lines
  where quote_id = v_dev2_id;

  -- =============================================
  -- DELIVERY NOTES with new columns
  -- =============================================
  insert into delivery_notes (id, organization_id, number, third_party_id, contact_id, document_date, delivered_at, status,
    order_id, subtotal, tax_total, total, delivery_number, delivery_address, internal_notes)
  values (v_bl1_id, v_org_id, 'BL-2026-0001', v_tp_nova, v_contact_nova,
    '2026-05-10', '2026-05-10', 'validated',
    v_cmd1_id, 5000, 800, 5800,
    'BL-001', 'Zone industrielle Gzenaya, Tanger', 'Premiere livraison partielle commande CMD-2026-0001')
  on conflict (id) do nothing;

  insert into delivery_note_lines (organization_id, delivery_note_id, product_id, description, quantity, unit_price, line_total,
    order_line_id, unit_id, delivered_quantity, line_order)
  select
    v_org_id, v_bl1_id, sol.product_id, sol.description, 3, sol.unit_price, sol.line_total,
    sol.id, sol.unit_id, 3, 1
  from sales_order_lines sol
  where sol.order_id = v_cmd1_id
    and sol.quote_line_id = (select id from sales_quote_lines where quote_id = v_dev2_id order by line_order limit 1);

end $$;
