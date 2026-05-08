-- Seed data for Products & Services module
-- Run after migration 003
-- Uses the existing felexia-demo organization

do $$
declare
  v_org_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_admin_id uuid;
  v_cat_marchandises uuid;
  v_cat_services uuid;
  v_cat_fournitures uuid;
  v_cat_materiel uuid;
  v_cat_maintenance uuid;
  v_cat_transport uuid;
  v_cat_abonnements uuid;
  v_cat_divers uuid;
  v_unit_u uuid;
  v_unit_h uuid;
  v_unit_j uuid;
  v_unit_mois uuid;
  v_unit_forfait uuid;
  v_unit_kg uuid;
  v_unit_l uuid;
  v_unit_m uuid;
  v_unit_boite uuid;
  v_unit_carton uuid;
  v_tva_0 uuid;
  v_tva_7 uuid;
  v_tva_10 uuid;
  v_tva_14 uuid;
  v_tva_20 uuid;
begin
  -- Get an admin user for the organization
  select id into v_admin_id from profiles limit 1;

  -- =============================================
  -- CATEGORIES
  -- =============================================
  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Marchandises', 'Produits destines a la revente', 'product', 'active', v_admin_id)
    returning id into v_cat_marchandises;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Services', 'Prestations de services', 'service', 'active', v_admin_id)
    returning id into v_cat_services;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Fournitures', 'Fournitures de bureau et consommables', 'product', 'active', v_admin_id)
    returning id into v_cat_fournitures;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Materiel', 'Equipements et materiels', 'product', 'active', v_admin_id)
    returning id into v_cat_materiel;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Maintenance', 'Services de maintenance et support', 'service', 'active', v_admin_id)
    returning id into v_cat_maintenance;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Transport', 'Services de transport et logistique', 'service', 'active', v_admin_id)
    returning id into v_cat_transport;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Abonnements', 'Abonnements et forfaits recurrents', 'mixed', 'active', v_admin_id)
    returning id into v_cat_abonnements;

  insert into product_categories (organization_id, name, description, type, status, created_by) values
    (v_org_id, 'Divers', 'Autres produits et services', 'mixed', 'active', v_admin_id)
    returning id into v_cat_divers;

  -- =============================================
  -- UNITS
  -- =============================================
  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Unite', 'U', 'Unite simple', v_admin_id) returning id into v_unit_u;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Heure', 'h', 'Travail a l''heure', v_admin_id) returning id into v_unit_h;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Jour', 'j', 'Travail a la journee', v_admin_id) returning id into v_unit_j;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Mois', 'mois', 'Abonnement mensuel', v_admin_id) returning id into v_unit_mois;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Forfait', 'forfait', 'Prestation forfaitaire', v_admin_id) returning id into v_unit_forfait;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Kilogramme', 'kg', 'Poids en kilogrammes', v_admin_id) returning id into v_unit_kg;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Litre', 'L', 'Volume en litres', v_admin_id) returning id into v_unit_l;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Metre', 'm', 'Longueur en metres', v_admin_id) returning id into v_unit_m;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Boite', 'boite', 'Conditionne en boite', v_admin_id) returning id into v_unit_boite;

  insert into units (organization_id, name, symbol, description, created_by) values
    (v_org_id, 'Carton', 'carton', 'Conditionne en carton', v_admin_id) returning id into v_unit_carton;

  -- =============================================
  -- TAX RATES (Morocco)
  -- =============================================
  insert into tax_rates (organization_id, name, rate, is_default, description, created_by) values
    (v_org_id, 'TVA 0%', 0, false, 'Exonere de TVA', v_admin_id) returning id into v_tva_0;

  insert into tax_rates (organization_id, name, rate, is_default, description, created_by) values
    (v_org_id, 'TVA 7%', 7, false, 'TVA reduite 7%', v_admin_id) returning id into v_tva_7;

  insert into tax_rates (organization_id, name, rate, is_default, description, created_by) values
    (v_org_id, 'TVA 10%', 10, false, 'TVA intermediaire 10%', v_admin_id) returning id into v_tva_10;

  insert into tax_rates (organization_id, name, rate, is_default, description, created_by) values
    (v_org_id, 'TVA 14%', 14, false, 'TVA reduite 14%', v_admin_id) returning id into v_tva_14;

  insert into tax_rates (organization_id, name, rate, is_default, description, created_by) values
    (v_org_id, 'TVA 20%', 20, true, 'TVA normale 20%', v_admin_id) returning id into v_tva_20;

  -- =============================================
  -- PRODUCTS
  -- =============================================
  insert into products (organization_id, type, sku, barcode, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, current_stock, stock_alert_enabled, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'product', 'FOUR-BUR-001', '6112345678901', 'Pack fournitures bureau', 'Lot complet de fournitures de bureau : stylos, cahiers, classeurs, post-it, agrafeuse', v_cat_fournitures, v_unit_u, 120.00, 250.00, 300.00, 130.00, 52.00, v_tva_20, true, 5, 50, true, true, true, 'active', v_admin_id, 'Produit a forte rotation. Commander des que le stock passe sous 10.');

  insert into products (organization_id, type, sku, barcode, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, current_stock, stock_alert_enabled, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'product', 'IMP-LAS-002', '6112345678902', 'Imprimante laser professionnelle', 'Imprimante laser A4 recto-verso, 30ppm, reseau WiFi, compatible AirPrint', v_cat_materiel, v_unit_u, 1850.00, 3200.00, 3840.00, 1350.00, 42.19, v_tva_20, true, 2, 15, true, true, true, 'active', v_admin_id, null);

  insert into products (organization_id, type, sku, barcode, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, current_stock, stock_alert_enabled, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'product', 'EMB-CAR-003', '6112345678903', 'Carton emballage standard', 'Carton d''emballage en carton ondule, 40x30x20cm, paquet de 10', v_cat_marchandises, v_unit_carton, 22.00, 45.00, 54.00, 23.00, 51.11, v_tva_20, true, 20, 200, true, true, true, 'active', v_admin_id, 'Vente par paquet de 10.');

  insert into products (organization_id, type, sku, barcode, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, current_stock, stock_alert_enabled, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'product', 'ROU-WIFI-004', '6112345678904', 'Routeur WiFi professionnel', 'Routeur WiFi 6 dual-band, gestion centralisee, VPN, securite avancee', v_cat_materiel, v_unit_u, 450.00, 890.00, 1068.00, 440.00, 49.44, v_tva_20, true, 3, 28, true, true, true, 'active', v_admin_id, 'Installation et configuration facturees separement.');

  insert into products (organization_id, type, sku, barcode, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, current_stock, stock_alert_enabled, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'product', 'PAP-A4-005', '6112345678905', 'Papier A4 80g', 'Ramette de papier A4 80g/m2, 500 feuilles, blancheur optimale', v_cat_fournitures, v_unit_u, 3.50, 8.50, 10.20, 5.00, 58.82, v_tva_20, true, 50, 500, true, true, true, 'active', v_admin_id, 'Vente a l''unite. Remise possible a partir de 10 ramettes.');

  -- =============================================
  -- SERVICES
  -- =============================================
  insert into products (organization_id, type, sku, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, min_stock, default_discount_rate, is_sellable, is_purchasable, status, created_by, notes) values
    (v_org_id, 'service', 'PREST-CONS-001', 'Prestation conseil mensuelle', 'Accompagnement conseil en gestion d''entreprise, 10h par mois', v_cat_services, v_unit_mois, 0, 5000.00, 6000.00, 5000.00, 100.00, v_tva_20, false, 0, 5, true, false, 'active', v_admin_id, 'Facturation mensuelle. Engagement minimum 3 mois.');

  insert into products (organization_id, type, sku, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, is_sellable, is_purchasable, status, created_by) values
    (v_org_id, 'service', 'INSTALL-MAT-002', 'Installation materiel', 'Installation et mise en service du materiel informatique sur site', v_cat_maintenance, v_unit_forfait, 0, 800.00, 960.00, 800.00, 100.00, v_tva_20, false, true, false, 'active', v_admin_id);

  insert into products (organization_id, type, sku, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, is_sellable, is_purchasable, status, created_by) values
    (v_org_id, 'service', 'MAINT-INFO-003', 'Maintenance informatique', 'Contrat de maintenance preventive et corrective pour parc informatique, par mois', v_cat_maintenance, v_unit_mois, 0, 1500.00, 1800.00, 1500.00, 100.00, v_tva_20, false, true, false, 'active', v_admin_id);

  insert into products (organization_id, type, sku, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, is_sellable, is_purchasable, status, created_by) values
    (v_org_id, 'service', 'FORM-UTIL-004', 'Formation utilisateur', 'Formation aux outils informatiques et logiciels de gestion, par jour', v_cat_services, v_unit_j, 0, 3000.00, 3600.00, 3000.00, 100.00, v_tva_20, false, true, false, 'active', v_admin_id);

  insert into products (organization_id, type, sku, name, description, category_id, unit_id, purchase_price_ht, sale_price_ht, sale_price_ttc, margin_amount, margin_rate, tax_rate_id, track_stock, is_sellable, is_purchasable, status, created_by) values
    (v_org_id, 'service', 'SUPPORT-PREM-005', 'Abonnement support premium', 'Support technique prioritaire 7j/7 avec intervention sous 2h ouvrées, par mois', v_cat_abonnements, v_unit_mois, 0, 2500.00, 3000.00, 2500.00, 100.00, v_tva_20, false, true, false, 'active', v_admin_id);

end $$;
