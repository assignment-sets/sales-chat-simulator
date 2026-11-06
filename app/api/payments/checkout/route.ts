import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getDodoClient } from "@/lib/dodo/client";
import { getDodoProductByTier } from "@/lib/dodo/products";
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

export interface CreateCheckoutBody {
  tier?: unknown;
  currency?: unknown;
  returnUrl?: unknown;
}

const VALID_TIERS = ["solo", "team", "scale"] as const;
type CheckoutTier = (typeof VALID_TIERS)[number];

const VALID_CURRENCIES = ["USD", "INR"] as const;
type CheckoutCurrency = (typeof VALID_CURRENCIES)[number];

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
    return internalError("Failed to resolve active workspace context", undefined, "payments/checkout");
  }

  const { organization, role } = activeContext;

  // 3. Enforce RBAC: only owner and admin can manage workspace subscription
  if (role !== "owner" && role !== "admin") {
    return forbidden("Only workspace owners and administrators can purchase or manage subscriptions");
  }

  // 4. Rate limit checkout creation to protect against abuse
  const rateLimit = await enforceRateLimit("payments.checkout.user", `u:${user.id}`);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  // 5. Parse and validate request body
  let body: CreateCheckoutBody;
  try {
    body = await request.json();
  } catch (err) {
    return badRequest("Invalid JSON body", err, "payments/checkout");
  }

  if (typeof body.tier !== "string" || !VALID_TIERS.includes(body.tier as CheckoutTier)) {
    return badRequest(
      "Invalid plan tier. Paid subscriptions must be one of: solo, team, scale",
      undefined,
      "payments/checkout"
    );
  }

  const tier = body.tier as CheckoutTier;
  let currency: CheckoutCurrency = "USD";
  if (typeof body.currency === "string") {
    if (VALID_CURRENCIES.includes(body.currency as CheckoutCurrency)) {
      currency = body.currency as CheckoutCurrency;
    } else {
      return badRequest("Invalid currency. Supported currencies are USD and INR", undefined, "payments/checkout");
    }
  }

  // 6. Enforce Single Active Subscription: Prevent duplicate subscriptions if workspace already has an active subscription
  const { data: activeSub } = await supabase
    .from("dodo_subscriptions")
    .select("id, status, plan_tier")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeSub) {
    return badRequest(
      `Workspace already has an active ${activeSub.plan_tier} subscription. Please manage upgrades, downgrades, or cancellations via the customer billing portal.`,
      undefined,
      "payments/checkout"
    );
  }

  // 7. Look up product details
  const product = getDodoProductByTier(tier);
  if (!product) {
    return badRequest(`No product found for plan tier: ${tier}`, undefined, "payments/checkout");
  }

  const returnUrl = resolveReturnUrl(request, body.returnUrl);

  // 7. Build customer details (attach existing dodo_customer_id if available)
  const customer = organization.dodo_customer_id
    ? { customer_id: organization.dodo_customer_id }
    : {
        email: user.email!,
        name: (user.user_metadata?.full_name as string) || user.email!.split("@")[0],
      };

  // 8. Invoke Dodo Payments SDK to generate checkout session
  try {
    const client = getDodoClient();
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: product.productId, quantity: 1 }],
      customer,
      billing_currency: currency,
      ...(currency === "INR" ? { billing_address: { country: "IN" as const } } : {}),
      feature_flags: {
        allow_currency_selection: true,
      },
      metadata: {
        organization_id: organization.id,
        user_id: user.id,
        target_tier: tier,
      },
      return_url: returnUrl,
    });

    if (!session.checkout_url) {
      throw new Error("Dodo Payments returned a checkout session without a checkout_url");
    }

    return apiSuccess({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    });
  } catch (err: unknown) {
    console.error("[Dodo Checkout] Failed to create checkout session:", err);
    return internalError(
      "Failed to initiate checkout session. Please try again later.",
      err,
      "payments/checkout"
    );
  }
}
