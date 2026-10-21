-- Migration: Add ai_feedback column to chats table for storing AI sales coach critiques
alter table public.chats
  add column if not exists ai_feedback text;
