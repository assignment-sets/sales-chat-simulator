import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDodoClient } from "@/lib/dodo/client";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { getRedisClient } from "@/lib/redis";
import { apiSuccess, apiError, internalError } from "@/lib/api-response";
import {
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleSubscriptionActive,
  handleSubscriptionRenewed,
  handleSubscriptionOnHold,
  handleSubscriptionCancelled,
  handleSubscriptionPlanChanged,
  handleSubscriptionUpdated,
  handleSubscriptionFailed,
} from "@/lib/dodo/webhook-handlers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY || env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey || webhookKey === "whsec_placeholder") {
    console.error("[Dodo Webhook] DODO_PAYMENTS_WEBHOOK_KEY is not configured.");
    return internalError("Webhook signature key unconfigured on server", undefined, "payments/webhook");
  }

  const webhookId = req.headers.get("webhook-id");
  const webhookSignature = req.headers.get("webhook-signature");
  const webhookTimestamp = req.headers.get("webhook-timestamp");

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return apiError("Missing required webhook signature headers", 401);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    return apiError("Unable to read request body", 400, err, "payments/webhook");
  }

  // Cryptographic signature verification using official SDK Standard Webhooks verification
  let event: any;
  try {
    const client = getDodoClient();
    event = client.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      },
      key: webhookKey,
    });
  } catch (err: unknown) {
    console.warn(`[Dodo Webhook] Signature verification failed:`, err instanceof Error ? err.message : err);
    return apiError("Invalid webhook signature", 401, err, "payments/webhook");
  }

  // Idempotency guard using Upstash Redis with a 72-hour expiration window
  const redis = getRedisClient();
  if (redis) {
    try {
      const idempotencyKey = `dodo:webhook:idempotency:${webhookId}`;
      const acquired = await redis.set(idempotencyKey, "1", {
        nx: true,
        ex: 60 * 60 * 72, // 72 hours
      });

      if (!acquired) {
        console.log(`[Dodo Webhook] Duplicate delivery skipped for webhook-id: ${webhookId}`);
        return apiSuccess({ received: true, duplicate: true });
      }
    } catch (redisErr) {
      console.warn("[Dodo Webhook] Redis idempotency check failed, proceeding without lock:", redisErr);
    }
  }

  // Resolve privileged Supabase admin client for server-to-server mutation
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    console.error("[Dodo Webhook] Failed to initialize Supabase admin client.");
    return internalError("Database administration client unconfigured", undefined, "payments/webhook");
  }

  console.log(`[Dodo Webhook] Processing event: ${event.type} (ID: ${webhookId})`);

  let result = { handled: false, action: "unhandled" };

  try {
    switch (event.type) {
      case "payment.succeeded":
        result = await handlePaymentSucceeded(supabase, event);
        break;

      case "payment.failed":
        result = await handlePaymentFailed(supabase, event);
        break;

      case "subscription.active":
        result = await handleSubscriptionActive(supabase, event);
        break;

      case "subscription.renewed":
        result = await handleSubscriptionRenewed(supabase, event);
        break;

      case "subscription.on_hold":
        result = await handleSubscriptionOnHold(supabase, event);
        break;

      case "subscription.cancelled":
        result = await handleSubscriptionCancelled(supabase, event);
        break;

      case "subscription.plan_changed":
        result = await handleSubscriptionPlanChanged(supabase, event);
        break;

      case "subscription.updated":
        result = await handleSubscriptionUpdated(supabase, event);
        break;

      case "subscription.failed":
        result = await handleSubscriptionFailed(supabase, event);
        break;

      default:
        console.log(`[Dodo Webhook] Unhandled event type ignored: ${event.type}`);
        return apiSuccess({ received: true, ignored: true, type: event.type });
    }
  } catch (err: unknown) {
    console.error(`[Dodo Webhook] Error processing event ${event.type}:`, err);
    return internalError("Error processing webhook event", err, "payments/webhook");
  }

  return apiSuccess({ received: true, type: event.type, result });
}
