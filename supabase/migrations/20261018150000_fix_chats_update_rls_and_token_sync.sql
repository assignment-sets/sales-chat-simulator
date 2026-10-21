-- Migration: Add missing UPDATE RLS policy on chats, backfill tokens_used, and add real-time token sync trigger

-- 1. Add missing UPDATE policy on public.chats
drop policy if exists "Authors or org admins can update chats" on public.chats;

create policy "Authors or org admins can update chats"
  on public.chats for update
  to authenticated
  using (
    private.is_org_member(organization_id, (select auth.uid()))
    and (
      user_id = (select auth.uid())
      or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
    )
  )
  with check (
    private.is_org_member(organization_id, (select auth.uid()))
    and (
      user_id = (select auth.uid())
      or private.get_user_org_role(organization_id, (select auth.uid())) in ('owner', 'admin')
    )
  );

-- 2. Backfill chats.tokens_used from existing messages
update public.chats c
set tokens_used = coalesce((
  select sum(m.total_tokens)
  from public.messages m
  where m.chat_id = c.id
), 0);

-- 3. Trigger to automatically keep chats.tokens_used in sync whenever messages with tokens are inserted
create or replace function public.sync_chat_tokens_used()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.total_tokens is not null and new.total_tokens > 0 then
    update public.chats
    set tokens_used = coalesce(tokens_used, 0) + new.total_tokens
    where id = new.chat_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_chat_tokens_used on public.messages;

create trigger trg_sync_chat_tokens_used
  after insert on public.messages
  for each row
  execute function public.sync_chat_tokens_used();
