-- Migration: Add a monthly per-organization AI usage ledger
--
-- This table is the authoritative record of Groq tokens consumed by every AI
-- call in an organization. It backs the monthly safety ceiling enforced in
-- `lib/ai-usage.ts` and gives operations a durable spend trail.
--
-- Reads go through RLS (org members only). Writes go exclusively through the
-- SECURITY DEFINER RPC below so counters can only be incremented, never reset
-- or forged by a client.

-- 1. Usage ledger, one row per organization per UTC calendar month
create table if not exists public.organization_ai_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start timestamptz not null,
  prompt_tokens bigint not null default 0 check (prompt_tokens >= 0),
  completion_tokens bigint not null default 0 check (completion_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, period_start)
);

-- 2. RLS: members can read their own organization's usage, nobody can write directly
alter table public.organization_ai_usage enable row level security;

drop policy if exists "Org members can read ai usage" on public.organization_ai_usage;
create policy "Org members can read ai usage"
  on public.organization_ai_usage for select
  to authenticated
  using (private.is_org_member(organization_id, (select auth.uid())));

-- 3. Atomic increment RPC (dual-checks membership before writing)
create or replace function public.record_org_ai_usage(
  target_org_id uuid,
  prompt_tokens bigint,
  completion_tokens bigint,
  total_tokens bigint,
  estimated_cost_usd numeric default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  period_start timestamptz;
begin
  caller_id := (select auth.uid());
  if caller_id is null then
    raise exception 'Unauthorized';
  end if;

  if private.get_user_org_role(target_org_id, caller_id) is null then
    raise exception 'Forbidden: Caller is not a member of this organization';
  end if;

  -- Reject negative counters so a buggy caller cannot wind the ledger backwards
  if prompt_tokens < 0 or completion_tokens < 0 or total_tokens < 0 or estimated_cost_usd < 0 then
    raise exception 'Invalid usage counters';
  end if;

  -- A single completion is a few thousand tokens. Anything larger is a bug or
  -- an attempt to exhaust the org's own ceiling, so refuse it outright.
  if prompt_tokens > 100000 or completion_tokens > 100000 or total_tokens > 100000 then
    raise exception 'Usage counters exceed the per-call maximum';
  end if;

  period_start := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';

  insert into public.organization_ai_usage (
    organization_id,
    period_start,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost_usd
  )
  values (
    target_org_id,
    period_start,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost_usd
  )
  on conflict (organization_id, period_start) do update
  set prompt_tokens = public.organization_ai_usage.prompt_tokens + excluded.prompt_tokens,
      completion_tokens = public.organization_ai_usage.completion_tokens + excluded.completion_tokens,
      total_tokens = public.organization_ai_usage.total_tokens + excluded.total_tokens,
      estimated_cost_usd = public.organization_ai_usage.estimated_cost_usd + excluded.estimated_cost_usd,
      updated_at = now();
end;
$$;

revoke execute on function public.record_org_ai_usage(uuid, bigint, bigint, bigint, numeric) from public, anon;
grant execute on function public.record_org_ai_usage(uuid, bigint, bigint, bigint, numeric) to authenticated;

-- 4. Backfill the current UTC month from the token columns already stored on messages
--    so the ceiling is accurate the moment this ships. Historical months are not
--    backfilled: the ceiling only ever reads the current period.
insert into public.organization_ai_usage (
  organization_id,
  period_start,
  prompt_tokens,
  completion_tokens,
  total_tokens
)
select
  c.organization_id,
  date_trunc('month', now() at time zone 'UTC') at time zone 'UTC',
  coalesce(sum(m.prompt_tokens), 0),
  coalesce(sum(m.completion_tokens), 0),
  coalesce(sum(m.total_tokens), 0)
from public.messages m
join public.chats c on c.id = m.chat_id
where c.organization_id is not null
  and m.created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
group by c.organization_id
on conflict (organization_id, period_start) do nothing;
