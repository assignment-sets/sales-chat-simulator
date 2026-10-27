-- Migration: Restrict update_organization_plan_tier RPC to service-role & billing webhooks only

-- 1. Redefine public.update_organization_plan_tier with strict service-role guard
create or replace function public.update_organization_plan_tier(
  target_org_id uuid,
  new_tier text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_org record;
begin
  -- Ensure caller is service_role or has internal superuser/migration bypass
  if (select auth.role()) is distinct from 'service_role'
     and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     and current_setting('app.allow_plan_tier_update', true) is distinct from 'true' then
    raise exception 'Forbidden: Plan tier modifications can only be performed by service-role or billing webhooks';
  end if;

  if new_tier not in ('starter', 'pro', 'scale') then
    raise exception 'Invalid plan tier: %', new_tier;
  end if;

  -- Set session flag locally so the organizations BEFORE UPDATE trigger passes
  perform set_config('app.allow_plan_tier_update', 'true', true);

  update public.organizations
  set plan_tier = new_tier,
      updated_at = now()
  where id = target_org_id
  returning id, name, slug, plan_tier, updated_at
  into updated_org;

  if not found then
    raise exception 'Organization not found';
  end if;

  return jsonb_build_object(
    'organization_id', updated_org.id,
    'plan_tier', updated_org.plan_tier,
    'updated_at', updated_org.updated_at
  );
end;
$$;

-- 2. Revoke from client/authenticated roles and grant solely to service_role
revoke execute on function public.update_organization_plan_tier(uuid, text) from public, anon, authenticated;
grant execute on function public.update_organization_plan_tier(uuid, text) to service_role;
