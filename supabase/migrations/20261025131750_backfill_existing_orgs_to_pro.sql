-- Migration: Backfill existing test organizations to 'pro' so current test users are not blocked
update public.organizations
set plan_tier = 'pro'
where plan_tier = 'starter';
