-- Migration: Add get_organization_members RPC function to fetch member details with emails and full names

create or replace function public.get_organization_members(target_org_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  email text,
  full_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Verify that caller belongs to this organization
  if not private.is_org_member(target_org_id, caller_id) then
    raise exception 'Forbidden: Not a member of this organization';
  end if;

  return query
  select
    om.id,
    om.organization_id,
    om.user_id,
    om.role,
    om.created_at,
    u.email::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1)
    )::text as full_name
  from public.organization_members om
  left join auth.users u on u.id = om.user_id
  where om.organization_id = target_org_id
  order by om.created_at asc;
end;
$$;

revoke execute on function public.get_organization_members(uuid) from public, anon;
grant execute on function public.get_organization_members(uuid) to authenticated;
