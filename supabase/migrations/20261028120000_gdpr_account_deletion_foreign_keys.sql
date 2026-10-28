-- Migration: Support GDPR account deletion with ON DELETE SET NULL on chats, messages, and organizations
-- Allows deleting auth.users without violating foreign keys, preserving anonymized team simulations.

-- 1. Organizations: created_by -> ON DELETE SET NULL
alter table public.organizations drop constraint if exists organizations_created_by_fkey;
alter table public.organizations alter column created_by drop not null;
alter table public.organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null;

-- 2. Chats: user_id -> ON DELETE SET NULL
alter table public.chats drop constraint if exists chats_user_id_fkey;
alter table public.chats alter column user_id drop not null;
alter table public.chats
  add constraint chats_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;

-- 3. Messages: user_id -> ON DELETE SET NULL
alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.messages alter column user_id drop not null;
alter table public.messages
  add constraint messages_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;
