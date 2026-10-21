-- Migration: Fix organization creation RLS (42501) by adding created_by column,
-- updating SELECT/INSERT policies, and creating an atomic RPC.

-- 1. Add created_by column to organizations
alter table public.organizations
  add column if not exists created_by uuid references auth.users(id) default auth.uid();

-- 2. Backfill created_by from existing organization_members (owner)
update public.organizations o
set created_by = (
  select om.user_id
  from public.organization_members om
  where om.organization_id = o.id and om.role = 'owner'
  limit 1
)
where o.created_by is null;

-- 3. Fix organizations RLS policies
-- Drop existing policies
drop policy if exists "Members can view their organizations" on public.organizations;
drop policy if exists "Authenticated users can create organizations" on public.organizations;

-- Recreate SELECT: creator OR member can read
create policy "Members or creators can view their organizations"
  on public.organizations for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or private.is_org_member(id, (select auth.uid()))
  );

-- Recreate INSERT: allow authenticated users, verify created_by matches caller
create policy "Authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (
    created_by is null or created_by = (select auth.uid())
  );

-- 4. Fix organization_members RLS policies
-- The SELECT policy currently requires is_org_member which fails on the
-- member-insert + RETURNING path (user just created org, not yet a member row).
drop policy if exists "Members can view organization members" on public.organization_members;
drop policy if exists "Owners, admins or initial creators can insert members" on public.organization_members;

-- Recreate SELECT: own rows OR fellow members can see each other
create policy "Members can view organization members"
  on public.organization_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_member(organization_id, (select auth.uid()))
  );

-- Recreate INSERT: allow initial owner (empty org) OR existing owner/admin
create policy "Owners, admins or initial creators can insert members"
  on public.organization_members for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and role = 'owner'
      and private.org_has_no_members(organization_id)
    )
    or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
  );

-- 5. Create atomic RPC for safe organization creation
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

  -- Create the organization
  insert into public.organizations (name, slug, created_by)
  values (trim(org_name), trim(org_slug), caller_id)
  returning id, created_at, updated_at into new_org_id, org_created_at, org_updated_at;

  -- Add the caller as owner
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, caller_id, 'owner')
  returning id into new_member_id;

  return jsonb_build_object(
    'id', new_org_id,
    'name', trim(org_name),
    'slug', trim(org_slug),
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
