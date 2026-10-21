-- Migration: Add evaluation score and outcome columns to chats for TypeSafe AI Jev decision engine

alter table public.chats
  add column if not exists score integer default null,
  add column if not exists evaluation_outcome text default 'in_progress',
  add column if not exists evaluation_summary jsonb default null;

-- Add check constraint for evaluation_outcome
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chats_evaluation_outcome_check'
  ) then
    alter table public.chats
      add constraint chats_evaluation_outcome_check
      check (evaluation_outcome in ('in_progress', 'deal_won', 'deal_lost'));
  end if;
end $$;

-- Index for querying completed or terminated simulations
create index if not exists idx_chats_eval_outcome on public.chats(organization_id, evaluation_outcome);
create index if not exists idx_chats_status on public.chats(organization_id, status);
