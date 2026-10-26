-- Migration: Secure plan_tier updates and provide atomic quota guard
-- 1. Protect organizations.plan_tier from direct client updates via a BEFORE UPDATE trigger
-- 2. Provide secure public.update_organization_plan_tier RPC for verified owner/admin updates
-- 3. Provide atomic public.create_chat_with_quota_check RPC to eliminate race conditions on simulations quota

-- 1. Function to enforce plan_tier immutability via direct client UPDATE
create or replace function private.prevent_direct_plan_tier_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- If plan_tier is changing
  if (NEW.plan_tier is distinct from OLD.plan_tier) then
    -- Check if session configuration flag 'app.allow_plan_tier_update' is set to 'true'
    if current_setting('app.allow_plan_tier_update', true) is distinct from 'true' then
      raise exception 'Direct modification of organization plan_tier is prohibited. Use authorized billing endpoints.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_direct_plan_tier_update on public.organizations;
create trigger trg_prevent_direct_plan_tier_update
  before update on public.organizations
  for each row
  execute function private.prevent_direct_plan_tier_update();

-- 2. Dedicated SECURITY DEFINER RPC to update plan_tier securely
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
  caller_id uuid;
  caller_role text;
  updated_org record;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  if new_tier not in ('starter', 'pro', 'scale') then
    raise exception 'Invalid plan tier: %', new_tier;
  end if;

  -- Dual-check: verify caller is owner or admin of target organization
  caller_role := private.get_user_org_role(target_org_id, caller_id);
  if caller_role not in ('owner', 'admin') then
    raise exception 'Forbidden: Only organization owners and admins can switch subscription plans';
  end if;

  -- Set session flag locally to allow trigger to pass
  perform set_config('app.allow_plan_tier_update', 'true', true);

  update public.organizations
  set plan_tier = new_tier,
      updated_at = now()
  where id = target_org_id
  returning id, name, slug, plan_tier, updated_at
  into updated_org;

  return jsonb_build_object(
    'organization_id', updated_org.id,
    'plan_tier', updated_org.plan_tier,
    'updated_at', updated_org.updated_at
  );
end;
$$;

revoke execute on function public.update_organization_plan_tier(uuid, text) from public, anon;
grant execute on function public.update_organization_plan_tier(uuid, text) to authenticated;

-- 3. Atomic simulation creation RPC with concurrency quota guard
create or replace function public.create_chat_with_quota(
  target_org_id uuid,
  target_product_name text,
  target_product_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_role text;
  current_org_tier text;
  max_simulations integer;
  current_month_simulations integer;
  start_of_month timestamptz;
  new_chat record;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Dual-check membership
  caller_role := private.get_user_org_role(target_org_id, caller_id);
  if caller_role is null then
    raise exception 'Forbidden: Caller is not a member of this organization';
  end if;

  -- Lock organization row exclusively for quota calculation to prevent concurrency race
  select plan_tier into current_org_tier
  from public.organizations
  where id = target_org_id
  for update;

  if current_org_tier is null then
    raise exception 'Organization not found';
  end if;

  -- Determine limit based on plan_tier
  if current_org_tier = 'scale' then
    max_simulations := 600;
  elsif current_org_tier = 'pro' then
    max_simulations := 150;
  else
    max_simulations := 15;
  end if;

  -- Calculate UTC start of current month
  start_of_month := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';

  -- Count existing simulations created this month
  select count(*) into current_month_simulations
  from public.chats
  where organization_id = target_org_id
    and created_at >= start_of_month;

  if current_month_simulations >= max_simulations then
    raise exception 'QuotaExceeded: Monthly simulation limit reached (%/% on % plan). Upgrade your workspace for more monthly sessions.',
      current_month_simulations, max_simulations, current_org_tier;
  end if;

  -- Insert chat atomically within the locked transaction
  insert into public.chats (
    user_id,
    organization_id,
    product_name,
    product_description,
    status
  )
  values (
    caller_id,
    target_org_id,
    trim(target_product_name),
    trim(target_product_description),
    'ACTIVE'
  )
  returning *
  into new_chat;

  return to_jsonb(new_chat);
end;
$$;

revoke execute on function public.create_chat_with_quota(uuid, text, text) from public, anon;
grant execute on function public.create_chat_with_quota(uuid, text, text) to authenticated;
