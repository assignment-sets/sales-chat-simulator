-- Migration: Allow service_role to update organization plan_tier directly
-- Webhooks running under the Supabase admin client (service_role) need to update
-- plan_tier, dodo_customer_id, and dodo_subscription_id without being blocked by
-- client-side immutability triggers.

create or replace function private.prevent_direct_plan_tier_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- If plan_tier is changing
  if (NEW.plan_tier is distinct from OLD.plan_tier) then
    -- Allow service_role / postgres (backend billing webhooks and administrative operations)
    if current_user in ('service_role', 'postgres') then
      return NEW;
    end if;

    -- Otherwise check if session configuration flag 'app.allow_plan_tier_update' is set to 'true'
    if current_setting('app.allow_plan_tier_update', true) is distinct from 'true' then
      raise exception 'Direct modification of organization plan_tier is prohibited. Use authorized billing endpoints.';
    end if;
  end if;
  return NEW;
end;
$$;
