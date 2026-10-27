-- Migration: Fix invitation-claim RPC auth bypass (close critical IDOR/elevation vulnerability)

-- 1. Revoke and drop vulnerable 2-parameter function overload
revoke execute on function public.claim_pending_org_invitations(uuid, text) from public, anon, authenticated;
drop function if exists public.claim_pending_org_invitations(uuid, text);

-- 2. Create secure zero-parameter function that reads identity strictly from auth context
create or replace function public.claim_pending_org_invitations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_email text;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    return;
  end if;

  caller_email := lower(trim(coalesce(
    auth.jwt() ->> 'email',
    (select email from auth.users where id = caller_id)
  )));

  if caller_email is null or caller_email = '' then
    return;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  select organization_id, caller_id, role
  from public.organization_invitations
  where lower(email) = caller_email
  on conflict (organization_id, user_id) do nothing;

  delete from public.organization_invitations
  where lower(email) = caller_email;
end;
$$;

-- 3. Set proper execution privileges
revoke execute on function public.claim_pending_org_invitations() from public, anon;
grant execute on function public.claim_pending_org_invitations() to authenticated;
