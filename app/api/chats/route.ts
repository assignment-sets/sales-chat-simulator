import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  apiSuccess,
  badRequest,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import { checkQuota } from "@/lib/entitlements";
import { enforceRateLimits } from "@/lib/rate-limit";
import { getActiveOrganization } from "@/lib/tenant";
import { invalidate } from "@/lib/cache";
import {
  dashboardKey,
  memberChatsKey,
  pricingKey,
} from "@/lib/cache/keys";

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

  // Throttle simulation creation before touching the database or quota checks
  const rateLimit = await enforceRateLimits(
    ["chats.create.user", `u:${user.id}`],
    ["chats.create.user.daily", `u:${user.id}`]
  );
  if (!rateLimit.ok) {
    return rateLimit.response;
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

  const cleanName = product_name.trim();
  const cleanDescription = product_description.trim();

  if (cleanName.length > 120) {
    return badRequest("product_name must be 120 characters or fewer");
  }

  if (cleanDescription.length > 2000) {
    return badRequest("product_description must be 2,000 characters or fewer");
  }

  // Enforce monthly simulation quota for the active organization's plan tier
  const quota = await checkQuota(supabase, {
    type: "monthly_simulations",
    organization: activeContext.organization,
  });
  if (!quota.ok) {
    return quota.response;
  }

  // Insert chat linked explicitly to both the author user and active organization
  // Try atomic RPC first to prevent concurrent quota race condition, fall back to standard insert if RPC pending
  const { data: rpcChat, error: rpcError } = await supabase.rpc(
    "create_chat_with_quota",
    {
      target_org_id: activeContext.organization.id,
      target_product_name: cleanName,
      target_product_description: cleanDescription,
    }
  );

  if (!rpcError && rpcChat) {
    await invalidate(
      dashboardKey(activeContext.organization.id),
      pricingKey(activeContext.organization.id),
      memberChatsKey(activeContext.organization.id, user.id)
    );
    return apiSuccess({ chat: rpcChat }, 201);
  }

  // If RPC is unavailable (e.g. migration pending application on remote), perform standard insert
  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      user_id: user.id,
      organization_id: activeContext.organization.id,
      product_name: cleanName,
      product_description: cleanDescription,
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

  // Chat persisted (fallback path): drop org aggregates for this org and user.
  await invalidate(
    dashboardKey(activeContext.organization.id),
    pricingKey(activeContext.organization.id),
    memberChatsKey(activeContext.organization.id, user.id)
  );

  return apiSuccess({ chat }, 201);
}
