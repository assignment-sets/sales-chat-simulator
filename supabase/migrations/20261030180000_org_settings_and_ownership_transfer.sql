-- Migration: Add atomic ownership transfer RPC and invitation resend helper

-- 1. Atomic Ownership Transfer
create or replace function public.transfer_organization_ownership(
  target_org_id uuid,
  new_owner_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_role text;
  old_owner_member_id uuid;
  new_owner_member_id uuid;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  select id, role into old_owner_member_id, caller_role
  from public.organization_members
  where organization_id = target_org_id and user_id = caller_id;

  if caller_role is distinct from 'owner' then
    raise exception 'Only the organization owner can transfer ownership';
  end if;

  if caller_id = new_owner_user_id then
    raise exception 'You are already the owner of this organization';
  end if;

  select id into new_owner_member_id
  from public.organization_members
  where organization_id = target_org_id and user_id = new_owner_user_id;

  if new_owner_member_id is null then
    raise exception 'Target user must be an active member of this organization before receiving ownership';
  end if;

  -- Step 1: Promote new owner first (satisfies remaining_owners > 0 invariant)
  update public.organization_members
  set role = 'owner'
  where id = new_owner_member_id;

  -- Step 2: Demote previous owner to admin
  update public.organization_members
  set role = 'admin'
  where id = old_owner_member_id;

  return jsonb_build_object(
    'success', true,
    'organization_id', target_org_id,
    'previous_owner_id', caller_id,
    'new_owner_id', new_owner_user_id
  );
end;
$$;

revoke execute on function public.transfer_organization_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;

-- 2. Resend Invitation Helper
create or replace function public.resend_organization_invitation(
  target_org_id uuid,
  target_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_role text;
  new_token text;
  new_expires timestamptz;
  target_row record;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  select private.get_user_org_role(target_org_id, caller_id) into caller_role;
  if caller_role not in ('owner', 'admin') then
    raise exception 'Only organization owners and admins can resend invitations';
  end if;

  select * into target_row
  from public.organization_invitations
  where id = target_invite_id and organization_id = target_org_id;

  if target_row.id is null then
    raise exception 'Invitation not found';
  end if;

  new_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  new_expires := now() + interval '7 days';

  update public.organization_invitations
  set token = new_token,
      expires_at = new_expires,
      invited_by = caller_id
  where id = target_row.id
  returning id, email, role, token, expires_at into target_row;

  return jsonb_build_object(
    'id', target_row.id,
    'email', target_row.email,
    'role', target_row.role,
    'token', target_row.token,
    'expires_at', target_row.expires_at
  );
end;
$$;

revoke execute on function public.resend_organization_invitation(uuid, uuid) from public, anon;
grant execute on function public.resend_organization_invitation(uuid, uuid) to authenticated;
