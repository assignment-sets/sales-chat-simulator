import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { getActiveOrganization } from "@/lib/tenant";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  // Resolve active organization context
  const activeContext = await getActiveOrganization(supabase, user.id, user.email);
  if (!activeContext) {
    return internalError("Failed to resolve organization context");
  }

  const { organization, role } = activeContext;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // 'personal' | 'team'

  // Dual-check tenant scoping:
  // - Default: personal practice simulations for the current user
  // - 'team' scope is only permitted for owner or admin roles
  let query = supabase
    .from("chats")
    .select("id, product_name, user_id, organization_id, created_at")
    .eq("organization_id", organization.id);

  if (scope === "team" && (role === "owner" || role === "admin")) {
    // Admin team view: all simulations in the active org
  } else {
    // Personal practice simulations
    query = query.eq("user_id", user.id);
  }

  const { data: chats, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError("Failed to fetch chats", error, "GET /api/chats");
  }

  return apiSuccess({
    chats: chats || [],
    active_organization_id: organization.id,
    role,
    scope: scope === "team" && (role === "owner" || role === "admin") ? "team" : "personal",
  });
}

export async function POST(request: Request) {
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

  let body: { product_name?: unknown; product_description?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "POST /api/chats:parse");
  }

  const { product_name, product_description } = body;

  if (
    typeof product_name !== "string" ||
    typeof product_description !== "string" ||
    !product_name.trim() ||
    !product_description.trim()
  ) {
    return badRequest("product_name and product_description are required");
  }

  // Insert chat linked explicitly to both the author user and active organization
  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      organization_id: activeContext.organization.id,
      product_name: product_name.trim(),
      product_description: product_description.trim(),
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error) {
    return internalError(
      "Failed to create simulation",
      error,
      "POST /api/chats:insert"
    );
  }

  return apiSuccess({ chat }, 201);
}
