-- Migration: Add tokenized invitation links and accept RPC flow for B2B organization invitations

-- 1. Alter organization_invitations to support secure tokenized acceptance links and expiration
alter table public.organization_invitations
  add column if not exists token text,
  add column if not exists expires_at timestamptz default (now() + interval '7 days') not null;

-- Populate tokens for any existing rows that might lack one
update public.organization_invitations
set token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where token is null;

-- Enforce unique and not-null constraints on token
alter table public.organization_invitations
  alter column token set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_invitations_token_key'
  ) then
    alter table public.organization_invitations add constraint organization_invitations_token_key unique (token);
  end if;
end;
$$;

create index if not exists idx_org_invitations_token on public.organization_invitations(token);

-- 2. Update public.invite_or_add_org_member RPC to generate tokens and return them
create or replace function public.invite_or_add_org_member(target_org_id uuid, target_email text, target_role text default 'member')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_role text;
  matched_user_id uuid;
  clean_email text;
  clean_role text;
  inv_token text;
  inv_expires timestamptz;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  select private.get_user_org_role(target_org_id, caller_id) into caller_role;
  if caller_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite members';
  end if;

  clean_email := lower(trim(target_email));
  clean_role := case when target_role in ('owner', 'admin', 'member') then target_role else 'member' end;

  -- Security check: only owners can grant or invite the owner role
  if clean_role = 'owner' and caller_role != 'owner' then
    raise exception 'Only organization owners can grant the owner role';
  end if;

  -- Look up existing registered user
  select id into matched_user_id from auth.users where lower(email) = clean_email limit 1;

  if matched_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (target_org_id, matched_user_id, clean_role)
    on conflict (organization_id, user_id) do update set role = clean_role;

    return jsonb_build_object(
      'status', 'added',
      'user_id', matched_user_id,
      'email', clean_email,
      'role', clean_role
    );
  else
    -- Unregistered invitations only allow 'admin' or 'member' per check constraint
    if clean_role = 'owner' then
      raise exception 'Unregistered users cannot be invited directly as owners';
    end if;

    inv_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    inv_expires := now() + interval '7 days';

    insert into public.organization_invitations (organization_id, email, role, invited_by, token, expires_at)
    values (target_org_id, clean_email, clean_role, caller_id, inv_token, inv_expires)
    on conflict (organization_id, email) do update set
      role = clean_role,
      token = inv_token,
      expires_at = inv_expires,
      invited_by = caller_id
    returning token, expires_at into inv_token, inv_expires;

    return jsonb_build_object(
      'status', 'invited',
      'email', clean_email,
      'role', clean_role,
      'token', inv_token,
      'expires_at', inv_expires
    );
  end if;
end;
$$;

revoke execute on function public.invite_or_add_org_member(uuid, text, text) from public, anon;
grant execute on function public.invite_or_add_org_member(uuid, text, text) to authenticated;

-- 3. Public RPC to inspect an invitation by token without exposing sensitive internal rows
create or replace function public.get_invitation_by_token(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  org_record record;
begin
  if invite_token is null or trim(invite_token) = '' then
    return null;
  end if;

  select id, organization_id, email, role, created_at, expires_at
  into inv
  from public.organization_invitations
  where token = trim(invite_token)
  limit 1;

  if inv is null then
    return null;
  end if;

  select id, name, slug into org_record
  from public.organizations
  where id = inv.organization_id;

  return jsonb_build_object(
    'id', inv.id,
    'email', inv.email,
    'role', inv.role,
    'created_at', inv.created_at,
    'expires_at', inv.expires_at,
    'is_expired', (now() > inv.expires_at),
    'organization', jsonb_build_object(
      'id', org_record.id,
      'name', org_record.name,
      'slug', org_record.slug
    )
  );
end;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- 4. RPC to accept an organization invitation using an active user session
create or replace function public.accept_organization_invitation(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_email text;
  inv record;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  caller_email := lower(trim(coalesce(
    auth.jwt() ->> 'email',
    (select email from auth.users where id = caller_id)
  )));

  if caller_email is null or caller_email = '' then
    raise exception 'Authenticated user has no verified email';
  end if;

  select id, organization_id, email, role, expires_at
  into inv
  from public.organization_invitations
  where token = trim(invite_token)
  limit 1;

  if inv is null then
    raise exception 'Invitation not found';
  end if;

  if now() > inv.expires_at then
    raise exception 'Invitation has expired';
  end if;

  if lower(inv.email) != caller_email then
    raise exception 'This invitation was issued for %, but you are signed in as %', inv.email, caller_email;
  end if;

  -- Add caller to organization members
  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, caller_id, inv.role)
  on conflict (organization_id, user_id) do update set role = inv.role;

  -- Delete the processed invitation
  delete from public.organization_invitations where id = inv.id;

  return jsonb_build_object(
    'status', 'accepted',
    'organization_id', inv.organization_id,
    'role', inv.role
  );
end;
$$;

revoke execute on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;
