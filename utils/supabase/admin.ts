import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a privileged Supabase client using the service-role key.
 * Used exclusively for internal administrative tasks, billing webhooks,
 * and service-role RPC calls that bypass RLS.
 *
 * NEVER import or invoke this in client-side components.
 */
export function createAdminSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
