insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Felexia Demo', 'felexia-demo')
on conflict (slug) do nothing;

insert into company_settings (organization_id, legal_name, commercial_name, ice, if_number, rc, tp, cnss, address, city)
values (
  '11111111-1111-1111-1111-111111111111',
  'Felexia Demo SARL',
  'Felexia Demo',
  '001234567000045',
  '48591230',
  'RC 129384 Casablanca',
  'TP 35678109',
  'CNSS 9845127',
  'Bd Abdelmoumen, Casablanca',
  'Casablanca'
)
on conflict (organization_id) do nothing;

insert into permissions (code, description) values
  ('admin.all', 'Administration complete'),
  ('sales.manage', 'Gestion ventes'),
  ('accounting.manage', 'Gestion comptable'),
  ('stock.manage', 'Gestion stock')
on conflict (code) do nothing;

insert into roles (organization_id, name, description) values
  ('11111111-1111-1111-1111-111111111111', 'admin', 'Administrateur'),
  ('11111111-1111-1111-1111-111111111111', 'manager', 'Manager'),
  ('11111111-1111-1111-1111-111111111111', 'sales', 'Commercial'),
  ('11111111-1111-1111-1111-111111111111', 'accountant', 'Comptable'),
  ('11111111-1111-1111-1111-111111111111', 'stock_user', 'Stock')
on conflict (organization_id, name) do nothing;

insert into numbering_sequences (organization_id, document_type, prefix, current_year, next_number) values
  ('11111111-1111-1111-1111-111111111111', 'DEV', 'DEV-', 2026, 3),
  ('11111111-1111-1111-1111-111111111111', 'CMD', 'CMD-', 2026, 2),
  ('11111111-1111-1111-1111-111111111111', 'BL', 'BL-', 2026, 2),
  ('11111111-1111-1111-1111-111111111111', 'FAC', 'FAC-', 2026, 4),
  ('11111111-1111-1111-1111-111111111111', 'PAY', 'PAY-', 2026, 2)
on conflict (organization_id, document_type, current_year) do nothing;

insert into tax_rates (id, organization_id, name, rate, is_default) values
  ('10000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Exonere', 0, false),
  ('10000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'TVA 20%', 20, true),
  ('10000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'TVA 10%', 10, false)
on conflict (id) do nothing;

insert into units (id, organization_id, name, symbol) values
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Unite', 'U'),
  ('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mois', 'mois')
on conflict (id) do nothing;

insert into product_categories (id, organization_id, name) values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Materiel informatique'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Consommables'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Services')
on conflict (id) do nothing;

insert into third_parties (id, organization_id, type, name, commercial_name, ice, if_number, rc, tp, cnss, email, phone, whatsapp, address, city, payment_terms_days, credit_limit, status) values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'customer', 'Atlas Market SARL', 'Atlas Market', '001982736000089', '40122390', 'RC 83211 Casablanca', 'TP 775421', null, 'finance@atlas-market.ma', '+212522314420', '+212661114420', 'Maarif, Casablanca', 'Casablanca', 30, 150000, 'active'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'both', 'Nova Industries Maroc', 'Nova Industries', '002149875000032', '50987110', 'RC 55301 Tanger', 'TP 198742', 'CNSS 6678213', 'achats@nova-industries.ma', '+212539611288', '+212660611288', 'Zone industrielle Gzenaya', 'Tanger', 45, 90000, 'active'),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'supplier', 'Sud Logistique SA', 'Sud Logistique', '001667490000071', '30991288', 'RC 22190 Marrakech', 'TP 442019', 'CNSS 5544211', 'contact@sudlogistique.ma', '+212524381090', '+212662381090', 'Sidi Ghanem', 'Marrakech', 30, 0, 'active'),
  ('40000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'supplier', 'Med Print Services', 'Med Print', '002753918000014', '60781244', 'RC 77811 Rabat', 'TP 981120', null, 'facturation@medprint.ma', '+212537704511', '+212661704511', 'Agdal', 'Rabat', 30, 0, 'active')
on conflict (id) do nothing;

insert into products (id, organization_id, type, sku, name, description, category_id, unit_id, purchase_price, sale_price, tax_rate_id, track_stock, min_stock, status) values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'product', 'PC-LEN-14', 'PC portable Lenovo 14 pouces', 'Poste bureautique PME', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 5950, 7200, '10000000-0000-0000-0000-000000000020', true, 5, 'active'),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'product', 'TON-HP-85A', 'Toner HP 85A compatible', 'Consommable impression', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 165, 240, '10000000-0000-0000-0000-000000000020', true, 8, 'active'),
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'service', 'SRV-MAINT', 'Maintenance mensuelle parc informatique', 'Contrat support', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 0, 3500, '10000000-0000-0000-0000-000000000020', false, 0, 'active')
on conflict (id) do nothing;

insert into warehouses (id, organization_id, name, code)
values ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Depot principal Casablanca', 'CASA')
on conflict (id) do nothing;

insert into stock_moves (organization_id, warehouse_id, product_id, move_type, quantity, source_document_type)
values
  ('11111111-1111-1111-1111-111111111111', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'in', 9, 'seed'),
  ('11111111-1111-1111-1111-111111111111', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'in', 3, 'seed');

insert into sales_quotes (id, organization_id, number, third_party_id, document_date, valid_until, status, subtotal, tax_total, total)
values
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'DEV-2026-0001', '40000000-0000-0000-0000-000000000001', '2026-05-02', '2026-06-01', 'sent', 34500, 6900, 41400),
  ('70000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'DEV-2026-0002', '40000000-0000-0000-0000-000000000002', '2026-05-06', '2026-06-05', 'accepted', 15500, 3100, 18600)
on conflict (id) do nothing;

insert into sales_invoices (id, organization_id, number, third_party_id, document_date, due_date, status, subtotal, tax_total, total, paid_amount)
values
  ('80000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'FAC-2026-0001', '40000000-0000-0000-0000-000000000001', '2026-04-15', '2026-05-15', 'partially_paid', 102000, 20400, 122400, 36000),
  ('80000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'FAC-2026-0002', '40000000-0000-0000-0000-000000000002', '2026-03-25', '2026-04-24', 'overdue', 20125, 4025, 24150, 0),
  ('80000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'FAC-2026-0003', '40000000-0000-0000-0000-000000000001', '2026-05-04', '2026-06-03', 'sent', 26000, 5200, 31200, 0)
on conflict (id) do nothing;

insert into customer_payments (organization_id, number, third_party_id, invoice_id, payment_date, status, method, amount)
values ('11111111-1111-1111-1111-111111111111', 'PAY-2026-0001', '40000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '2026-05-05', 'confirmed', 'virement', 36000)
on conflict (organization_id, number) do nothing;

insert into payment_reminders (organization_id, invoice_id, reminder_date, status, channel, notes)
values ('11111111-1111-1111-1111-111111111111', '80000000-0000-0000-0000-000000000002', '2026-05-10', 'planned', 'email', 'Relance facture en retard');

insert into cash_accounts (id, organization_id, name, type, opening_balance)
values
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Banque CIH', 'bank', 160000),
  ('90000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Caisse principale', 'cash', 12000)
on conflict (id) do nothing;

insert into cash_transactions (organization_id, cash_account_id, transaction_date, type, amount, label, source_document_type)
values
  ('11111111-1111-1111-1111-111111111111', '90000000-0000-0000-0000-000000000001', '2026-05-05', 'in', 36000, 'Encaissement FAC-2026-0001', 'customer_payment'),
  ('11111111-1111-1111-1111-111111111111', '90000000-0000-0000-0000-000000000001', '2026-05-03', 'out', 12400, 'Paiement fournisseur Sud Logistique', 'supplier_payment'),
  ('11111111-1111-1111-1111-111111111111', '90000000-0000-0000-0000-000000000002', '2026-05-01', 'out', 980, 'Achat fournitures bureau', 'cash_expense');

insert into third_parties (
  id, organization_id, primary_type, types, name, commercial_name, code,
  ice, if_number, rc, patente, cnss, email, phone, mobile, website, address,
  postal_code, city, country, vat_subject, vat_number, payment_terms_days,
  credit_limit, prospect_source, prospect_status, potential_value,
  next_follow_up_date, supplier_product_categories, supplier_payment_terms,
  supplier_rating, supplier_delivery_delay_days, status, notes
) values
  ('41000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'prospect', array['prospect'], 'Atlas Distribution SARL', 'Atlas Distribution', 'PR2605-00001', '003451982000021', '57123481', 'RC 66210 Casablanca', 'PAT 771204', null, 'contact@atlasdistribution.ma', '+212522450120', '+212661450120', 'https://atlasdistribution.ma', 'Zone industrielle Ain Sebaa', '20250', 'Casablanca', 'MA', true, 'TVA-003451982', 30, 0, 'Salon Maroc PME', 'qualifie', 85000, '2026-05-20', null, null, null, null, 'active', 'Prospect interesse par un contrat cadre.'),
  ('41000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'customer', array['customer'], 'Maroc Bureau Services', 'MBS', 'CU2605-00001', '003984512000077', '66200134', 'RC 190224 Rabat', 'PAT 884501', 'CNSS 7712450', 'finance@marocbureau.ma', '+212537200145', '+212660200145', 'https://marocbureau.ma', 'Avenue Annakhil, Hay Riad', '10100', 'Rabat', 'MA', true, 'TVA-003984512', 45, 120000, null, null, 0, null, null, null, null, null, 'active', 'Client grand compte.'),
  ('41000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'supplier', array['supplier'], 'AgriNord Fournitures', 'AgriNord', 'SU2605-00001', '004222109000018', '33190877', 'RC 55120 Fes', 'PAT 662100', null, 'achat@agrinord.ma', '+212535800910', '+212661800910', null, 'Route de Meknes', '30000', 'Fes', 'MA', false, null, 30, 0, null, null, 0, null, 'Equipements agricoles, pieces detachees', 'Paiement a 30 jours fin de mois', 4, 7, 'active', 'Fournisseur fiable sur consommables.'),
  ('41000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'customer', array['customer','supplier'], 'TechnoService Rabat', 'TechnoService', 'CU2605-00002', '004873320000064', '44567112', 'RC 77812 Rabat', 'PAT 229019', 'CNSS 1234509', 'direction@technoservice.ma', '+212537701245', '+212662701245', 'https://technoservice.ma', 'Agdal', '10090', 'Rabat', 'MA', true, 'TVA-004873320', 30, 80000, null, null, 0, null, 'Maintenance, sous-traitance technique', 'Virement bancaire', 5, 3, 'active', 'Tiers mixte client et fournisseur.'),
  ('41000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'prospect', array['prospect','supplier'], 'Casa Pack Solutions', 'Casa Pack', 'PR2605-00002', '005020110000034', '70012988', 'RC 231908 Casablanca', 'PAT 440129', null, 'contact@casapack.ma', '+212522880034', '+212663880034', null, 'Lissasfa', '20230', 'Casablanca', 'MA', true, 'TVA-005020110', 30, 0, 'Recommandation client', 'contacte', 42000, '2026-05-18', 'Emballages, packaging', 'A negocier', 3, 10, 'active', 'Prospect et fournisseur potentiel.')
on conflict (id) do nothing;

insert into third_party_contacts (organization_id, third_party_id, full_name, job_title, phone, mobile, email, is_primary, notes)
values
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000001', 'Youssef Benjelloun', 'Directeur achats', '+212522450120', '+212661450121', 'y.benjelloun@atlasdistribution.ma', true, 'Decisionnaire'),
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000002', 'Salma El Fassi', 'Responsable finance', '+212537200145', '+212660200146', 'salma.elfassi@marocbureau.ma', true, null),
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000003', 'Hamza Tazi', 'Commercial', '+212535800910', '+212661800911', 'hamza.tazi@agrinord.ma', true, null);

insert into third_party_addresses (organization_id, third_party_id, label, type, address, postal_code, city, country, is_default)
values
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000001', 'Siege', 'billing', 'Zone industrielle Ain Sebaa', '20250', 'Casablanca', 'MA', true),
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000001', 'Depot logistique', 'delivery', 'Tit Mellil', '20640', 'Casablanca', 'MA', false),
  ('11111111-1111-1111-1111-111111111111', '41000000-0000-0000-0000-000000000002', 'Facturation', 'billing', 'Avenue Annakhil, Hay Riad', '10100', 'Rabat', 'MA', true);
