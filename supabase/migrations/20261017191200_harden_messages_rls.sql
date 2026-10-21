-- Harden RLS policies on messages to enforce relational parent chat ownership

drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Users can select own messages" on public.messages;

-- Enforce parent chat ownership on insert (prevents planting orphan or cross-tenant messages)
create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chats
      where public.chats.id = messages.chat_id
        and public.chats.user_id = (select auth.uid())
    )
  );

-- Enforce parent chat ownership on select
create policy "Users can select own messages"
  on public.messages for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chats
      where public.chats.id = messages.chat_id
        and public.chats.user_id = (select auth.uid())
    )
  );
