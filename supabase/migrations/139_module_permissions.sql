-- 139: droits lecture/écriture par module, noms de rôles uniques sans tenir compte de la casse.
-- Apply after 138. Additive. Existing role_permissions rows are kept.
-- Rollback: supabase/rollbacks/139_module_permissions_rollback.sql

insert into public.permissions (code, description)
values
  ('dashboard.read', 'Consulter le tableau de bord'),
  ('dashboard.write', 'Modifier le tableau de bord'),
  ('ventes.read', 'Consulter les ventes'),
  ('ventes.write', 'Modifier les ventes'),
  ('achats.read', 'Consulter les achats'),
  ('achats.write', 'Modifier les achats'),
  ('stock.read', 'Consulter le stock'),
  ('stock.write', 'Modifier le stock'),
  ('tresorerie.read', 'Consulter la trésorerie'),
  ('tresorerie.write', 'Modifier la trésorerie'),
  ('comptabilite.read', 'Consulter la comptabilité'),
  ('comptabilite.write', 'Modifier la comptabilité'),
  ('tva.read', 'Consulter la TVA'),
  ('tva.write', 'Modifier la TVA'),
  ('rh.read', 'Consulter les ressources humaines'),
  ('rh.write', 'Modifier les ressources humaines'),
  ('paie.read', 'Consulter la paie'),
  ('paie.write', 'Modifier la paie'),
  ('parametres.read', 'Consulter les paramètres'),
  ('parametres.write', 'Modifier les paramètres')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
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
)
where lower(btrim(r.name)) in ('owner', 'admin', 'administrateur', 'proprietaire', 'propriétaire')
on conflict do nothing;

do $$ begin
  if not exists (
    select 1 from public.roles
    group by organization_id, lower(btrim(name))
    having count(*) > 1
  ) then
    create unique index if not exists roles_org_name_ci_unique
      on public.roles (organization_id, lower(btrim(name)));
  end if;
end $$;
