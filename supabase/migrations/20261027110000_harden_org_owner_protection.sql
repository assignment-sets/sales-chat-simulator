-- Migration: Harden organization owner security, RLS policies, and database triggers

-- 1. Update public.invite_or_add_org_member RPC to prevent admins from granting owner role
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

    return jsonb_build_object('status', 'added', 'user_id', matched_user_id, 'email', clean_email);
  else
    -- Unregistered invitations only allow 'admin' or 'member' per check constraint
    if clean_role = 'owner' then
      raise exception 'Unregistered users cannot be invited directly as owners';
    end if;

    insert into public.organization_invitations (organization_id, email, role, invited_by)
    values (target_org_id, clean_email, clean_role, caller_id)
    on conflict (organization_id, email) do update set role = clean_role;

    return jsonb_build_object('status', 'invited', 'email', clean_email);
  end if;
end;
$$;

revoke execute on function public.invite_or_add_org_member(uuid, text, text) from public, anon;
grant execute on function public.invite_or_add_org_member(uuid, text, text) to authenticated;

-- 2. Trigger function to enforce owner invariants & prevent unauthorized owner grant/demotion/deletion
create or replace function private.enforce_org_member_owner_protection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_role text;
  remaining_owners int;
begin
  -- If parent organization is being deleted (CASCADE delete), allow cleanup
  if not exists (select 1 from public.organizations where id = OLD.organization_id) then
    return OLD;
  end if;

  caller_id := (select auth.uid());

  -- Handle DELETE
  if TG_OP = 'DELETE' then
    if OLD.role = 'owner' then
      -- If an authenticated user is executing the delete, ensure only an owner (or self leaving) can attempt it
      if caller_id is not null and OLD.user_id != caller_id then
        select private.get_user_org_role(OLD.organization_id, caller_id) into caller_role;
        if caller_role is distinct from 'owner' then
          raise exception 'Only organization owners can remove an owner';
        end if;
      end if;

      -- Check last owner invariant: org must never be left without an owner
      select count(*) into remaining_owners
      from public.organization_members
      where organization_id = OLD.organization_id
        and role = 'owner'
        and id != OLD.id;

      if remaining_owners = 0 then
        raise exception 'Cannot remove the last organization owner';
      end if;
    end if;

    return OLD;
  end if;

  -- Handle UPDATE
  if TG_OP = 'UPDATE' then
    if NEW.role is distinct from OLD.role then
      -- Promoting someone to owner: only an owner can grant owner role
      if NEW.role = 'owner' and OLD.role != 'owner' then
        if caller_id is not null then
          select private.get_user_org_role(NEW.organization_id, caller_id) into caller_role;
          if caller_role is distinct from 'owner' then
            raise exception 'Only organization owners can grant the owner role';
          end if;
        end if;
      end if;

      -- Demoting an owner: only an owner can demote, and last owner cannot be demoted
      if OLD.role = 'owner' and NEW.role != 'owner' then
        if caller_id is not null then
          select private.get_user_org_role(OLD.organization_id, caller_id) into caller_role;
          if caller_role is distinct from 'owner' then
            raise exception 'Only organization owners can demote an owner';
          end if;
        end if;

        -- Check last owner invariant
        select count(*) into remaining_owners
        from public.organization_members
        where organization_id = OLD.organization_id
          and role = 'owner'
          and id != OLD.id;

        if remaining_owners = 0 then
          raise exception 'Cannot demote the last organization owner';
        end if;
      end if;
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_org_member_owner_protection on public.organization_members;
create trigger trg_enforce_org_member_owner_protection
  before update or delete on public.organization_members
  for each row
  execute function private.enforce_org_member_owner_protection();

-- 3. Harden RLS policies on public.organization_members
-- Drop existing permissive policies
drop policy if exists "Owners and admins can update member roles" on public.organization_members;
drop policy if exists "Members can leave or admins can remove members" on public.organization_members;
drop policy if exists "Owners, admins or initial creators can insert members" on public.organization_members;

-- INSERT policy: initial creator can be owner; existing owners can insert any role; admins can only insert admin/member
create policy "Owners, admins or initial creators can insert members"
  on public.organization_members for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and role = 'owner'
      and private.org_has_no_members(organization_id)
    )
    or (
      private.get_user_org_role(organization_id, (select auth.uid())) = 'owner'
    )
    or (
      private.get_user_org_role(organization_id, (select auth.uid())) = 'admin'
      and role in ('admin', 'member')
    )
  );

-- UPDATE policies: separate owner from admin permissions
create policy "Owners can update any member role"
  on public.organization_members for update
  to authenticated
  using (private.get_user_org_role(organization_id, (select auth.uid())) = 'owner')
  with check (private.get_user_org_role(organization_id, (select auth.uid())) = 'owner');

create policy "Admins can update non-owner member roles"
  on public.organization_members for update
  to authenticated
  using (
    private.get_user_org_role(organization_id, (select auth.uid())) = 'admin'
    and role != 'owner'
  )
  with check (
    private.get_user_org_role(organization_id, (select auth.uid())) = 'admin'
    and role in ('admin', 'member')
  );

-- DELETE policies: separate owner from admin permissions, allow members to leave
create policy "Members can leave own organization"
  on public.organization_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners can remove members"
  on public.organization_members for delete
  to authenticated
  using (private.get_user_org_role(organization_id, (select auth.uid())) = 'owner');

create policy "Admins can remove non-owner members"
  on public.organization_members for delete
  to authenticated
  using (
    private.get_user_org_role(organization_id, (select auth.uid())) = 'admin'
    and role != 'owner'
  );
