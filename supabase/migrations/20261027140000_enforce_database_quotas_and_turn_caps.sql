-- Migration: Enforce monthly simulation quotas, max owned orgs, and simulation turn caps at the database level

-- 1. Trigger to enforce monthly simulation quotas on public.chats
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
    when 'pro' then 150
    else 15 -- starter
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

drop trigger if exists trg_enforce_chat_monthly_quota on public.chats;
create trigger trg_enforce_chat_monthly_quota
  before insert on public.chats
  for each row
  execute function private.enforce_chat_monthly_quota();

-- 2. Trigger to enforce the 3-owned-organizations cap on public.organization_members
create or replace function private.enforce_max_owned_orgs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_count integer;
begin
  -- Only enforce when role is 'owner'
  if NEW.role = 'owner' then
    select count(*) into owned_count
    from public.organization_members
    where user_id = NEW.user_id
      and role = 'owner'
      and id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if owned_count >= 3 then
      raise exception 'OrganizationLimitExceeded: You can own up to 3 organizations. Contact support if you need more.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_max_owned_orgs on public.organization_members;
create trigger trg_enforce_max_owned_orgs
  before insert or update on public.organization_members
  for each row
  execute function private.enforce_max_owned_orgs();

-- Update public.create_organization_with_owner RPC to check 3-org limit upfront
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
  owned_count integer;
  new_org_id uuid;
  new_member_id uuid;
  org_plan_tier text;
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

  -- Check owned organizations cap
  select count(*) into owned_count
  from public.organization_members
  where user_id = caller_id
    and role = 'owner';

  if owned_count >= 3 then
    raise exception 'OrganizationLimitExceeded: You can own up to 3 organizations. Contact support if you need more.';
  end if;

  -- Create the organization with default 'starter' plan_tier
  insert into public.organizations (name, slug, created_by, plan_tier)
  values (trim(org_name), trim(org_slug), caller_id, 'starter')
  returning id, plan_tier, created_at, updated_at
  into new_org_id, org_plan_tier, org_created_at, org_updated_at;

  -- Add the caller as owner
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, caller_id, 'owner')
  returning id into new_member_id;

  return jsonb_build_object(
    'id', new_org_id,
    'name', trim(org_name),
    'slug', trim(org_slug),
    'plan_tier', org_plan_tier,
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

-- 3. Trigger to enforce the 40-user-turn cap on public.messages
create or replace function private.enforce_max_user_turns_per_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_turns integer;
begin
  -- Only cap user role messages; assistant and system messages are not constrained
  if NEW.role = 'user' then
    select count(*) into user_turns
    from public.messages
    where chat_id = NEW.chat_id
      and role = 'user';

    if user_turns >= 40 then
      raise exception 'TurnLimitExceeded: Turn cap of 40 reached for this simulation. Start a new simulation to keep practicing.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_max_user_turns_per_chat on public.messages;
create trigger trg_enforce_max_user_turns_per_chat
  before insert on public.messages
  for each row
  execute function private.enforce_max_user_turns_per_chat();
