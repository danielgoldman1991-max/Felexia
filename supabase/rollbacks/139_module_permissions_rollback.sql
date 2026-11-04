drop index if exists public.roles_org_name_ci_unique;

delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and p.code in (
    'dashboard.read', 'dashboard.write',
    'ventes.read', 'ventes.write',
    'achats.read', 'achats.write',
    'stock.read', 'stock.write',
    'tresorerie.read', 'tresorerie.write',
    'comptabilite.read', 'comptabilite.write',
    'tva.read', 'tva.write',
    'rh.read', 'rh.write',
    'paie.read', 'paie.write',
    'parametres.read', 'parametres.write'
  );

delete from public.permissions
where code in (
  'dashboard.read', 'dashboard.write',
  'ventes.read', 'ventes.write',
  'achats.read', 'achats.write',
  'stock.read', 'stock.write',
  'tresorerie.read', 'tresorerie.write',
  'comptabilite.read', 'comptabilite.write',
  'tva.read', 'tva.write',
  'rh.read', 'rh.write',
  'paie.read', 'paie.write',
  'parametres.read', 'parametres.write'
);
