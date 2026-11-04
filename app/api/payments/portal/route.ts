import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getDodoClient } from "@/lib/dodo/client";
import { getActiveOrganization } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  apiSuccess,
  badRequest,
  forbidden,
  unauthorized,
  internalError,
} from "@/lib/api-response";
import { env } from "@/lib/env";

export interface CreatePortalBody {
  returnUrl?: unknown;
  sendEmail?: unknown;
}

function resolveReturnUrl(request: NextRequest, rawReturnUrl?: unknown): string {
  const origin = request.nextUrl.origin || env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";
  const defaultUrl = `${origin}/dashboard`;

  if (typeof rawReturnUrl !== "string" || !rawReturnUrl.trim()) {
    return defaultUrl;
  }

  const trimmed = rawReturnUrl.trim();

  // Allow relative URLs starting with /
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return `${origin}${trimmed}`;
  }

  // Allow full URLs only if they match the safe app origin
  try {
    const parsed = new URL(trimmed);
    const parsedOrigin = parsed.origin;
    if (parsedOrigin === origin || parsed.hostname === "chat2sell.in" || parsed.hostname === "localhost") {
      return trimmed;
    }
  } catch {
    // Malformed URL, fall back to safe default
  }

  return defaultUrl;
}

export async function POST(request: NextRequest) {
  // 1. Authenticate user session
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized("Authentication required");
  }

  // 2. Resolve active organization tenant context
  const activeContext = await getActiveOrganization(supabase, user.id, user.email);
  if (!activeContext) {
    return internalError("Failed to resolve active workspace context", undefined, "payments/portal");
  }

  const { organization, role } = activeContext;

  // 3. Enforce RBAC: only owner and admin can access billing management
  if (role !== "owner" && role !== "admin") {
    return forbidden("Only workspace owners and administrators can access billing management");
  }

  // 4. Rate limit portal creations to protect against abuse
  const rateLimit = await enforceRateLimit("payments.portal.user", `u:${user.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // 5. Parse request body (optional)
  let body: CreatePortalBody = {};
  try {
    const text = await request.text();
    if (text && text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch (err) {
    return badRequest("Invalid JSON body", err, "payments/portal");
  }

  // 6. Resolve Dodo customer ID
  let customerId = organization.dodo_customer_id;

  if (!customerId) {
    // Check organizations table directly
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("dodo_customer_id")
      .eq("id", organization.id)
      .maybeSingle();

    if (orgRow?.dodo_customer_id) {
      customerId = orgRow.dodo_customer_id;
    }
  }

  if (!customerId) {
    // Check dodo_subscriptions table
    const { data: subRow } = await supabase
      .from("dodo_subscriptions")
      .select("customer_id")
      .eq("organization_id", organization.id)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subRow?.customer_id) {
      customerId = subRow.customer_id;
    }
  }

  if (!customerId) {
    return badRequest(
      "No billing account exists for this workspace. Please subscribe to a plan first.",
      undefined,
      "payments/portal"
    );
  }

  const returnUrl = resolveReturnUrl(request, body.returnUrl);
  const sendEmail = body.sendEmail === true;

  // 7. Invoke Dodo Payments SDK to generate customer portal session
  try {
    const client = getDodoClient();
    const session = await client.customers.customerPortal.create(customerId, {
      return_url: returnUrl,
      ...(sendEmail ? { send_email: true } : {}),
    });

    if (!session.link) {
      throw new Error("Dodo Payments returned a customer portal session without a link");
    }

    return apiSuccess({
      portalUrl: session.link,
    });
  } catch (err: unknown) {
    console.error("[Dodo Portal] Failed to create customer portal session:", err);
    return internalError(
      "Failed to open billing portal. Please try again later.",
      err,
      "payments/portal"
    );
  }
}
