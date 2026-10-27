-- Migration: Add automated updated_at triggers to core mutable tables

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Chats table
drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at
  before update on public.chats
  for each row
  execute function private.set_updated_at();

-- 2. Organizations table
drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row
  execute function private.set_updated_at();

-- 3. Organization AI usage ledger
drop trigger if exists set_organization_ai_usage_updated_at on public.organization_ai_usage;
create trigger set_organization_ai_usage_updated_at
  before update on public.organization_ai_usage
  for each row
  execute function private.set_updated_at();
