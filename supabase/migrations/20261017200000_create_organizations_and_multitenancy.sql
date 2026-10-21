-- Migration: Create organizations, organization_members, invitations, and multi-tenant RLS

-- 1. Create organizations table
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Create organization_members table
create table if not exists public.organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamptz default now() not null,
  unique (organization_id, user_id)
);

-- 3. Create organization_invitations table
create table if not exists public.organization_invitations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'member')) default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  unique (organization_id, email)
);

-- 4. Create private helper functions for RLS performance and security
create schema if not exists private;

create or replace function private.is_org_member(check_org_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = check_user_id
  );
$$;

create or replace function private.get_user_org_role(check_org_id uuid, check_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select role from public.organization_members
  where organization_id = check_org_id and user_id = check_user_id
  limit 1;
$$;

create or replace function private.org_has_no_members(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.organization_members
    where organization_id = $1
  );
$$;

-- Secure member invitation and enrollment helper
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

  -- Look up existing registered user
  select id into matched_user_id from auth.users where lower(email) = clean_email limit 1;

  if matched_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (target_org_id, matched_user_id, clean_role)
    on conflict (organization_id, user_id) do update set role = clean_role;

    return jsonb_build_object('status', 'added', 'user_id', matched_user_id, 'email', clean_email);
  else
    insert into public.organization_invitations (organization_id, email, role, invited_by)
    values (target_org_id, clean_email, clean_role, caller_id)
    on conflict (organization_id, email) do update set role = clean_role;

    return jsonb_build_object('status', 'invited', 'email', clean_email);
  end if;
end;
$$;

-- Function to claim pending invitations when a user logs in or registers
create or replace function public.claim_pending_org_invitations(user_id uuid, user_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text;
begin
  clean_email := lower(trim(user_email));
  if clean_email is null or clean_email = '' then
    return;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  select organization_id, user_id, role
  from public.organization_invitations
  where lower(email) = clean_email
  on conflict (organization_id, user_id) do nothing;

  delete from public.organization_invitations
  where lower(email) = clean_email;
end;
$$;

revoke execute on function public.invite_or_add_org_member(uuid, text, text) from public, anon;
grant execute on function public.invite_or_add_org_member(uuid, text, text) to authenticated;
revoke execute on function public.claim_pending_org_invitations(uuid, text) from public, anon;
grant execute on function public.claim_pending_org_invitations(uuid, text) to authenticated;

-- 5. Add organization_id column to chats table
alter table public.chats
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- 6. Backfill existing users and chats with default workspace
do $$
declare
  target_user record;
  new_org_id uuid;
  user_email text;
  clean_slug text;
begin
  -- Backfill every existing user in auth.users
  for target_user in select id, email from auth.users loop
    if not exists (select 1 from public.organization_members where user_id = target_user.id) then
      user_email := target_user.email;
      if user_email is null or user_email = '' then
        user_email := 'user-' || substr(target_user.id::text, 1, 8);
      end if;

      clean_slug := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-z0-9]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);

      insert into public.organizations (name, slug)
      values (split_part(user_email, '@', 1) || '''s Workspace', clean_slug)
      returning id into new_org_id;

      insert into public.organization_members (organization_id, user_id, role)
      values (new_org_id, target_user.id, 'owner')
      on conflict do nothing;

      -- Assign chats belonging to this user
      update public.chats
      set organization_id = new_org_id
      where user_id = target_user.id and organization_id is null;
    end if;
  end loop;

  -- Fallback for any orphan chats whose user might not be in auth.users loop
  for target_user in select distinct user_id from public.chats where organization_id is null loop
    insert into public.organizations (name, slug)
    values ('Workspace ' || substr(target_user.user_id::text, 1, 6), 'ws-' || substr(gen_random_uuid()::text, 1, 8))
    returning id into new_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (new_org_id, target_user.user_id, 'owner')
    on conflict do nothing;

    update public.chats
    set organization_id = new_org_id
    where user_id = target_user.user_id and organization_id is null;
  end loop;
end $$;

-- Enforce not-null on chats.organization_id once backfilled
alter table public.chats alter column organization_id set not null;

-- 7. Enable RLS on newly created tables
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

-- 8. Policies for organizations
create policy "Members can view their organizations"
  on public.organizations for select
  to authenticated
  using (private.is_org_member(id, (select auth.uid())));

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  to authenticated
  with check (true);

create policy "Owners and admins can update their organizations"
  on public.organizations for update
  to authenticated
  using (private.get_user_org_role(id, (select auth.uid())) in ('owner', 'admin'))
  with check (private.get_user_org_role(id, (select auth.uid())) in ('owner', 'admin'));

create policy "Owners can delete their organizations"
  on public.organizations for delete
  to authenticated
  using (private.get_user_org_role(id, (select auth.uid())) = 'owner');

-- 9. Policies for organization_members
create policy "Members can view organization members"
  on public.organization_members for select
  to authenticated
  using (private.is_org_member(organization_id, (select auth.uid())));

create policy "Owners, admins or initial creators can insert members"
  on public.organization_members for insert
  to authenticated
  with check (
    (user_id = (select auth.uid()) and role = 'owner' and private.org_has_no_members(organization_id))
    or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
  );

create policy "Owners and admins can update member roles"
  on public.organization_members for update
  to authenticated
  using (private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin'))
  with check (private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin'));

create policy "Members can leave or admins can remove members"
  on public.organization_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
  );

-- 10. Policies for organization_invitations
create policy "Members can view invitations"
  on public.organization_invitations for select
  to authenticated
  using (private.is_org_member(organization_id, (select auth.uid())));

create policy "Admins and owners can manage invitations"
  on public.organization_invitations for all
  to authenticated
  using (private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin'))
  with check (private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin'));

-- 11. Harden RLS policies on chats for multi-tenancy & role-based visibility
drop policy if exists "Users can select own chats" on public.chats;
drop policy if exists "Users can insert own chats" on public.chats;
drop policy if exists "Users can delete own chats" on public.chats;
drop policy if exists "Org members can select chats" on public.chats;
drop policy if exists "Org members can insert chats" on public.chats;
drop policy if exists "Authors or org admins can delete chats" on public.chats;

create policy "Org members can select chats"
  on public.chats for select
  to authenticated
  using (
    private.is_org_member(organization_id, (select auth.uid()))
    and (
      user_id = (select auth.uid())
      or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
    )
  );

create policy "Org members can insert chats"
  on public.chats for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id, (select auth.uid()))
  );

create policy "Authors or org admins can delete chats"
  on public.chats for delete
  to authenticated
  using (
    private.is_org_member(organization_id, (select auth.uid()))
    and (
      user_id = (select auth.uid())
      or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
    )
  );

-- 12. Harden RLS policies on messages for multi-tenancy
drop policy if exists "Users can select own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Org members can select messages" on public.messages;
drop policy if exists "Org members can insert messages" on public.messages;

create policy "Org members can select messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chats
      where public.chats.id = messages.chat_id
        and private.is_org_member(public.chats.organization_id, (select auth.uid()))
        and (
          public.chats.user_id = (select auth.uid())
          or private.get_user_org_role(public.chats.organization_id, (select auth.uid())) in ('owner', 'admin')
        )
    )
  );

create policy "Org members can insert messages"
  on public.messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chats
      where public.chats.id = messages.chat_id
        and private.is_org_member(public.chats.organization_id, (select auth.uid()))
        and (
          public.chats.user_id = (select auth.uid())
          or private.get_user_org_role(public.chats.organization_id, (select auth.uid())) in ('owner', 'admin')
        )
    )
  );

-- 13. Performance indexes
create index if not exists idx_org_members_user_org on public.organization_members(user_id, organization_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);
create index if not exists idx_chats_org_id on public.chats(organization_id);
create index if not exists idx_chats_org_user on public.chats(organization_id, user_id);
create index if not exists idx_org_invitations_email on public.organization_invitations(email);
