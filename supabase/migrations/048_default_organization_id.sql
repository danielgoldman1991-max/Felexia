alter table profiles add column if not exists default_organization_id uuid references organizations(id) on delete set null;
