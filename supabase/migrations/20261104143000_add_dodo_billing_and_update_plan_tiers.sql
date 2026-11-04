-- Migration: Add Dodo Payments billing tables and update plan tiers to 4-tier model
-- 1. Migrate existing organizations on 'pro' to 'team' and update check constraint
-- 2. Add Dodo customer and subscription IDs to public.organizations
-- 3. Create public.dodo_subscriptions with multi-tenant RLS
-- 4. Create public.dodo_payments with multi-tenant RLS
-- 5. Update create_chat_with_quota and enforce_chat_monthly_quota to new simulation limits
-- 6. Update update_organization_plan_tier RPC to accept ('starter', 'solo', 'team', 'scale')

-- 1. Migrate plan tiers and update constraint
-- Enable local bypass flag so the organizations BEFORE UPDATE trigger allows plan_tier change
set local app.allow_plan_tier_update = 'true';

-- Drop old plan_tier check constraint if present
alter table public.organizations
  drop constraint if exists organizations_plan_tier_check;

-- Migrate any existing 'pro' organizations to 'team'
update public.organizations
set plan_tier = 'team',
    updated_at = now()
where plan_tier = 'pro';

-- Add updated check constraint for the 4-tier model
alter table public.organizations
  add constraint organizations_plan_tier_check
  check (plan_tier in ('starter', 'solo', 'team', 'scale'));

-- 2. Add Dodo customer and subscription IDs to public.organizations
alter table public.organizations
  add column if not exists dodo_customer_id text,
  add column if not exists dodo_subscription_id text;

create index if not exists idx_organizations_dodo_customer_id
  on public.organizations (dodo_customer_id);

create index if not exists idx_organizations_dodo_subscription_id
  on public.organizations (dodo_subscription_id);

-- 3. Create public.dodo_subscriptions table
create table if not exists public.dodo_subscriptions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null,
  status text not null,
  plan_tier text not null check (plan_tier in ('solo', 'team', 'scale')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dodo_subscriptions_organization_id
  on public.dodo_subscriptions (organization_id);

create index if not exists idx_dodo_subscriptions_customer_id
  on public.dodo_subscriptions (customer_id);

-- Add automated updated_at trigger
drop trigger if exists set_dodo_subscriptions_updated_at on public.dodo_subscriptions;
create trigger set_dodo_subscriptions_updated_at
  before update on public.dodo_subscriptions
  for each row
  execute function private.set_updated_at();

-- Enable RLS on dodo_subscriptions
alter table public.dodo_subscriptions enable row level security;

-- Policy: Organization members can read subscriptions
drop policy if exists "Organization members can read subscriptions" on public.dodo_subscriptions;
create policy "Organization members can read subscriptions"
  on public.dodo_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = dodo_subscriptions.organization_id
        and om.user_id = (select auth.uid())
    )
  );

-- 4. Create public.dodo_payments table
create table if not exists public.dodo_payments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id text,
  amount integer not null,
  currency text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dodo_payments_org_created_at
  on public.dodo_payments (organization_id, created_at desc);

-- Enable RLS on dodo_payments
alter table public.dodo_payments enable row level security;

-- Policy: Organization members can read payments
drop policy if exists "Organization members can read payments" on public.dodo_payments;
create policy "Organization members can read payments"
  on public.dodo_payments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = dodo_payments.organization_id
        and om.user_id = (select auth.uid())
    )
  );

-- 5. Update simulation quotas in create_chat_with_quota RPC
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

  -- Determine limit based on plan_tier: starter 10, solo 50, team 200, scale 600
  if current_org_tier = 'scale' then
    max_simulations := 600;
  elsif current_org_tier = 'team' or current_org_tier = 'pro' then
    max_simulations := 200;
  elsif current_org_tier = 'solo' then
    max_simulations := 50;
  else
    max_simulations := 10;
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

-- Also update private.enforce_chat_monthly_quota trigger to match the new limits
create or replace function private.enforce_chat_monthly_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_tier text;
  quota_limit integer;
  used_count integer;
  start_of_month timestamptz;
begin
  -- If chat is not assigned to an organization (legacy fallback), allow insert
  if NEW.organization_id is null then
    return NEW;
  end if;

  -- Resolve organization plan tier
  select plan_tier into org_tier
  from public.organizations
  where id = NEW.organization_id;

  if org_tier is null then
    org_tier := 'starter';
  end if;

  quota_limit := case org_tier
    when 'scale' then 600
    when 'team' then 200
    when 'pro' then 200
    when 'solo' then 50
    else 10 -- starter
  end;

  -- Calculate UTC start of current month
  start_of_month := date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  -- Count existing chats created this month for this organization
  select count(*) into used_count
  from public.chats
  where organization_id = NEW.organization_id
    and created_at >= start_of_month;

  if used_count >= quota_limit then
    raise exception 'QuotaExceeded: Monthly simulation limit reached (%/% on % plan). Upgrade your workspace for more monthly sessions.',
      used_count, quota_limit, org_tier;
  end if;

  return NEW;
end;
$$;

-- 6. Update public.update_organization_plan_tier RPC to accept ('starter', 'solo', 'team', 'scale')
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

  if new_tier not in ('starter', 'solo', 'team', 'scale') then
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

revoke execute on function public.update_organization_plan_tier(uuid, text) from public, anon, authenticated;
grant execute on function public.update_organization_plan_tier(uuid, text) to service_role;
