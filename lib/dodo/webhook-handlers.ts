import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { getDodoProductById } from "@/lib/dodo/products";

export interface WebhookEventResult {
  handled: boolean;
  action: string;
  organizationId?: string | null;
  error?: string;
}

/**
 * Resolves the target organization UUID through a 3-layer lookup strategy:
 * 1. Explicit metadata: metadata.organization_id (set during checkout)
 * 2. Subscription linkage: lookup in public.dodo_subscriptions by subscription_id
 * 3. Customer linkage: lookup in public.organizations by dodo_customer_id
 */
export async function resolveOrganizationId(
  supabase: SupabaseClient<Database>,
  params: {
    metadataOrgId?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
  }
): Promise<string | null> {
  const { metadataOrgId, subscriptionId, customerId } = params;

  // 1. Direct metadata match
  if (metadataOrgId && metadataOrgId.trim()) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", metadataOrgId.trim())
      .maybeSingle();

    if (org?.id) {
      return org.id;
    }
  }

  // 2. Subscription linkage match
  if (subscriptionId && subscriptionId.trim()) {
    const { data: sub } = await supabase
      .from("dodo_subscriptions")
      .select("organization_id")
      .eq("id", subscriptionId.trim())
      .maybeSingle();

    if (sub?.organization_id) {
      return sub.organization_id;
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("dodo_subscription_id", subscriptionId.trim())
      .maybeSingle();

    if (org?.id) {
      return org.id;
    }
  }

  // 3. Customer linkage match
  if (customerId && customerId.trim()) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("dodo_customer_id", customerId.trim())
      .maybeSingle();

    if (org?.id) {
      return org.id;
    }
  }

  return null;
}

/**
 * Resolves the PlanTier ('solo' | 'team' | 'scale') from the product ID or fallback metadata.
 */
export function resolveTierFromProduct(
  productId?: string | null,
  fallbackTier?: string | null
): "solo" | "team" | "scale" {
  if (productId) {
    const product = getDodoProductById(productId);
    if (product) {
      return product.tierId;
    }
  }

  if (fallbackTier === "solo" || fallbackTier === "team" || fallbackTier === "scale") {
    return fallbackTier;
  }

  // Legacy fallback if 'pro' was provided
  if (fallbackTier === "pro") {
    return "team";
  }

  // Default to solo if product cannot be resolved
  return "solo";
}

/**
 * Handler for payment.succeeded
 */
export async function handlePaymentSucceeded(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const payment = payload.data;
  const paymentId = payment.payment_id;
  const subscriptionId = payment.subscription_id || null;
  const customerId = payment.customer?.customer_id || null;
  const metadataOrgId = payment.metadata?.organization_id || null;
  const amount = payment.total_amount || 0;
  const currency = payment.currency || "USD";

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  if (!orgId) {
    console.warn(`[Dodo Webhook] payment.succeeded: Unable to resolve organization for payment ${paymentId}`);
    return { handled: false, action: "unresolved_organization" };
  }

  // 1. Record payment transaction in public.dodo_payments
  const { error: paymentError } = await supabase.from("dodo_payments").upsert(
    {
      id: paymentId,
      organization_id: orgId,
      subscription_id: subscriptionId,
      amount,
      currency,
      status: "succeeded",
      created_at: payment.created_at || new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (paymentError) {
    console.error(`[Dodo Webhook] Error recording payment ${paymentId}:`, paymentError);
  }

  // 2. Ensure organization is linked to the Dodo customer ID
  if (customerId) {
    await supabase
      .from("organizations")
      .update({
        dodo_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);
  }

  return { handled: true, action: "payment_recorded", organizationId: orgId };
}

/**
 * Handler for payment.failed
 */
export async function handlePaymentFailed(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const payment = payload.data;
  const paymentId = payment.payment_id;
  const subscriptionId = payment.subscription_id || null;
  const customerId = payment.customer?.customer_id || null;
  const metadataOrgId = payment.metadata?.organization_id || null;
  const amount = payment.total_amount || 0;
  const currency = payment.currency || "USD";

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  if (!orgId) {
    console.warn(`[Dodo Webhook] payment.failed: Unable to resolve organization for payment ${paymentId}`);
    return { handled: false, action: "unresolved_organization" };
  }

  // Record failed transaction in public.dodo_payments
  await supabase.from("dodo_payments").upsert(
    {
      id: paymentId,
      organization_id: orgId,
      subscription_id: subscriptionId,
      amount,
      currency,
      status: "failed",
      created_at: payment.created_at || new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // Per business policy, customer enters 3-day grace period where retries continue
  console.warn(`[Dodo Webhook] payment.failed for org ${orgId}. 3-day grace period in effect.`);

  return { handled: true, action: "failed_payment_recorded", organizationId: orgId };
}

/**
 * Handler for subscription.active
 */
export async function handleSubscriptionActive(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;
  const customerId = sub.customer?.customer_id;
  const productId = sub.product_id;
  const metadataOrgId = sub.metadata?.organization_id || null;
  const metadataTier = sub.metadata?.target_tier || null;

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  if (!orgId) {
    console.error(`[Dodo Webhook] subscription.active: Organization could not be resolved for sub ${subscriptionId}`);
    return { handled: false, action: "unresolved_organization" };
  }

  const planTier = resolveTierFromProduct(productId, metadataTier);

  // 1. Upsert public.dodo_subscriptions
  await supabase.from("dodo_subscriptions").upsert(
    {
      id: subscriptionId,
      organization_id: orgId,
      customer_id: customerId,
      status: "active",
      plan_tier: planTier,
      current_period_start: sub.previous_billing_date || sub.created_at || new Date().toISOString(),
      current_period_end: sub.next_billing_date || null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // 2. Update public.organizations plan_tier and IDs
  const { error: orgError } = await supabase
    .from("organizations")
    .update({
      plan_tier: planTier,
      dodo_customer_id: customerId,
      dodo_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (orgError) {
    console.error(`[Dodo Webhook] Failed to update organization tier for ${orgId}:`, orgError);
    return { handled: false, action: "org_update_failed", error: orgError.message };
  }

  console.log(`[Dodo Webhook] Activated ${planTier} subscription for org ${orgId}`);
  return { handled: true, action: "subscription_activated", organizationId: orgId };
}

/**
 * Handler for subscription.renewed
 */
export async function handleSubscriptionRenewed(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;
  const customerId = sub.customer?.customer_id;
  const metadataOrgId = sub.metadata?.organization_id || null;

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  if (!orgId) {
    return { handled: false, action: "unresolved_organization" };
  }

  // Update subscription billing dates
  await supabase
    .from("dodo_subscriptions")
    .update({
      status: "active",
      current_period_start: sub.previous_billing_date || new Date().toISOString(),
      current_period_end: sub.next_billing_date || null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  return { handled: true, action: "subscription_renewed", organizationId: orgId };
}

/**
 * Handler for subscription.on_hold
 */
export async function handleSubscriptionOnHold(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;

  await supabase
    .from("dodo_subscriptions")
    .update({
      status: "on_hold",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  console.warn(`[Dodo Webhook] Subscription ${subscriptionId} moved to on_hold.`);
  return { handled: true, action: "subscription_on_hold" };
}

/**
 * Handler for subscription.cancelled
 */
export async function handleSubscriptionCancelled(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;
  const customerId = sub.customer?.customer_id;
  const metadataOrgId = sub.metadata?.organization_id || null;

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  const nextBillingDate = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
  const now = new Date();

  // Mark subscription as cancelled
  await supabase
    .from("dodo_subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: true,
      updated_at: now.toISOString(),
    })
    .eq("id", subscriptionId);

  // If period has elapsed (or no future period), immediately revert to starter
  if (orgId && (!nextBillingDate || nextBillingDate <= now)) {
    await supabase
      .from("organizations")
      .update({
        plan_tier: "starter",
        updated_at: now.toISOString(),
      })
      .eq("id", orgId);
    console.log(`[Dodo Webhook] Subscription period elapsed for org ${orgId}. Reverted to starter.`);
  }

  return { handled: true, action: "subscription_cancelled", organizationId: orgId };
}

/**
 * Handler for subscription.plan_changed
 */
export async function handleSubscriptionPlanChanged(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;
  const productId = sub.product_id;
  const customerId = sub.customer?.customer_id;
  const metadataOrgId = sub.metadata?.organization_id || null;

  const orgId = await resolveOrganizationId(supabase, {
    metadataOrgId,
    subscriptionId,
    customerId,
  });

  if (!orgId) {
    return { handled: false, action: "unresolved_organization" };
  }

  const newTier = resolveTierFromProduct(productId);

  // 1. Update subscription row
  await supabase
    .from("dodo_subscriptions")
    .update({
      plan_tier: newTier,
      status: "active",
      current_period_start: sub.previous_billing_date || new Date().toISOString(),
      current_period_end: sub.next_billing_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  // 2. Immediately reflect new plan tier on organization
  await supabase
    .from("organizations")
    .update({
      plan_tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  console.log(`[Dodo Webhook] Organization ${orgId} plan changed to ${newTier}`);
  return { handled: true, action: "plan_changed", organizationId: orgId };
}

/**
 * Handler for subscription.failed
 */
export async function handleSubscriptionFailed(
  supabase: SupabaseClient<Database>,
  payload: any
): Promise<WebhookEventResult> {
  const sub = payload.data;
  const subscriptionId = sub.subscription_id;

  await supabase
    .from("dodo_subscriptions")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  return { handled: true, action: "subscription_failed" };
}
