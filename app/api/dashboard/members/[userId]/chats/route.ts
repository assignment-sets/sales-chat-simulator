import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  forbidden,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { getActiveOrganization } from "@/lib/tenant";

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  const activeContext = await getActiveOrganization(supabase, user.id, user.email);
  if (!activeContext) {
    return internalError("Failed to resolve active organization");
  }

  const { organization, role } = activeContext;

  if (role !== "owner" && role !== "admin") {
    return forbidden("Viewing member activity is restricted to organization owners and admins");
  }

  // Fetch all chats for this member within the active organization
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, product_name, product_description, status, tokens_used, created_at, updated_at")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return internalError(
      "Failed to fetch member simulations",
      error,
      "GET /api/dashboard/members/[userId]/chats"
    );
  }

  return apiSuccess({
    simulations: chats || [],
    userId,
    organizationId: organization.id,
  });
}
