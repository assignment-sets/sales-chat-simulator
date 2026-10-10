-- Create chats table
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_name text not null,
  product_description text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on chats
alter table public.chats enable row level security;

-- Policies for chats
create policy "Users can select own chats"
  on public.chats for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can insert own chats"
  on public.chats for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "Users can delete own chats"
  on public.chats for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Policies for messages
create policy "Users can select own messages"
  on public.messages for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- Performance indexes
create index if not exists idx_chats_user_id on public.chats(user_id);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at asc);
