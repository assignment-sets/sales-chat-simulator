-- Migration: Add plan_tier column to public.organizations for subscription tier and quota enforcement

-- 1. Add plan_tier column defaulting to 'starter'
alter table public.organizations
  add column if not exists plan_tier text not null default 'starter';

-- 2. Add check constraint for valid plan tiers
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_plan_tier_check'
  ) then
    alter table public.organizations
      add constraint organizations_plan_tier_check
      check (plan_tier in ('starter', 'pro', 'scale'));
  end if;
end $$;

-- 3. Update create_organization_with_owner RPC to include plan_tier in returned JSONB
create or replace function public.create_organization_with_owner(
  org_name text,
  org_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  new_org_id uuid;
  new_member_id uuid;
  org_plan_tier text;
  org_created_at timestamptz;
  org_updated_at timestamptz;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Validate input
  if org_name is null or trim(org_name) = '' then
    raise exception 'Organization name is required';
  end if;
  if org_slug is null or trim(org_slug) = '' then
    raise exception 'Organization slug is required';
  end if;

  -- Create the organization with default 'starter' plan_tier
  insert into public.organizations (name, slug, created_by, plan_tier)
  values (trim(org_name), trim(org_slug), caller_id, 'starter')
  returning id, plan_tier, created_at, updated_at
  into new_org_id, org_plan_tier, org_created_at, org_updated_at;

  -- Add the caller as owner
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, caller_id, 'owner')
  returning id into new_member_id;

  return jsonb_build_object(
    'id', new_org_id,
    'name', trim(org_name),
    'slug', trim(org_slug),
    'plan_tier', org_plan_tier,
    'created_by', caller_id,
    'created_at', org_created_at,
    'updated_at', org_updated_at,
    'member_id', new_member_id,
    'role', 'owner'
  );
end;
$$;

revoke execute on function public.create_organization_with_owner(text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;
