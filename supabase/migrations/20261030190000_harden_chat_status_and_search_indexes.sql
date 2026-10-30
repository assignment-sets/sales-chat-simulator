-- Migration: Harden chat status check constraint and add search optimization indexes

-- 1. Add check constraint on chats.status
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chats_status_check'
  ) then
    alter table public.chats
      add constraint chats_status_check
      check (status in ('ACTIVE', 'ARCHIVED', 'WON', 'LOST'));
  end if;
end $$;

-- 2. Add search indexes for title and scenario text matching within an organization
create index if not exists idx_chats_org_product_name
  on public.chats(organization_id, product_name);

create index if not exists idx_chats_org_product_desc
  on public.chats(organization_id, product_description);
