import { createServerSupabaseClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  apiSuccess,
  badRequest,
  internalError,
  unauthorized,
} from "@/lib/api-response";
import {
  ACTIVE_ORG_COOKIE_NAME,
  getActiveOrganization,
} from "@/lib/tenant";

export async function GET() {
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
    return internalError("Failed to resolve organization context");
  }

  return apiSuccess({
    active_organization: activeContext.organization,
    role: activeContext.role,
    organizations: activeContext.allOrganizations,
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

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON request body", err, "POST /api/organizations:parse");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return badRequest("Organization name is required");
  }

  if (name.length < 2 || name.length > 50) {
    return badRequest("Organization name must be between 2 and 50 characters");
  }

  const cleanSlug = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).substring(2, 8)}`;

  // Create organization + owner membership atomically via RPC
  const { data: result, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    { org_name: name, org_slug: cleanSlug }
  );

  if (rpcError || !result) {
    return internalError("Failed to create organization", rpcError, "POST /api/organizations:create");
  }

  const org = {
    id: result.id,
    name: result.name,
    slug: result.slug,
    created_by: result.created_by,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };

  // Set newly created org as active in cookies
  try {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE_NAME, org.id, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    console.warn("Could not set active org cookie in POST /api/organizations:", err);
  }

  return apiSuccess(
    {
      organization: org,
      role: result.role,
    },
    201
  );
}
