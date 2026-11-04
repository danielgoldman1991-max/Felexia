-- Rollback of 125. Drops only the newsletter and guide-download tables.

drop table if exists public.guide_access_grants;
drop table if exists public.guide_downloads;
drop table if exists public.newsletter_subscribers;
