-- Migration 053: Add customer_category_id to third_parties

-- Add column if missing
alter table third_parties add column if not exists customer_category_id uuid;

-- Drop any existing FK (from 051 or 052 which may have used default NO ACTION)
alter table third_parties drop constraint if exists third_parties_customer_category_id_fkey;

-- Add FK with proper on delete set null
alter table third_parties
  add constraint third_parties_customer_category_id_fkey
  foreign key (customer_category_id)
  references customer_categories(id)
  on delete set null;

-- Index for performance
drop index if exists third_parties_customer_category_id_idx;
create index third_parties_customer_category_id_idx on third_parties (customer_category_id);

notify pgrst, 'reload schema';
