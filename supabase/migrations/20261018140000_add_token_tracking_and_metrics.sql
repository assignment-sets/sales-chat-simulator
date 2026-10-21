-- Migration: Add token tracking and metrics for team dashboard oversight

-- 1. Add token tracking columns to messages
alter table public.messages
  add column if not exists prompt_tokens integer default 0,
  add column if not exists completion_tokens integer default 0,
  add column if not exists total_tokens integer default 0;

-- 2. Add tokens_used column to chats
alter table public.chats
  add column if not exists tokens_used integer default 0;

-- 3. Create indexes for performant dashboard metrics aggregation
create index if not exists idx_messages_chat_tokens on public.messages(chat_id, total_tokens);
create index if not exists idx_chats_org_user_created on public.chats(organization_id, user_id, created_at desc);
