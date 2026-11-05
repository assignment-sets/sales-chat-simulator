import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import DodoPayments from "dodopayments";

const envContent = fs.readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1].trim()] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SECRET_KEY;
const dodoApiKey = env.DODO_PAYMENTS_API_KEY;
const dodoEnv = (env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";

const supabase = createClient(supabaseUrl, supabaseKey);
const dodo = new DodoPayments({
  bearerToken: dodoApiKey,
  environment: dodoEnv,
});

async function remediate() {
  const soloSubscriptionId = "sub_0NrEQ2vbN0ocmhVEBIN5Z";
  const scaleSubscriptionId = "sub_0NrD9iYlNUxXMEcFGRAPf";
  const orgId = "d05fb458-d970-4213-a67a-a2d3723b5873";

  console.log(`[Remediation] Cancelling duplicate Solo subscription: ${soloSubscriptionId}...`);

  try {
    const res = await dodo.subscriptions.update(soloSubscriptionId, {
      status: "cancelled",
    });
    console.log(`[Remediation] Dodo response for cancelling ${soloSubscriptionId}:`, res.status);
  } catch (err: any) {
    console.error(`[Remediation] Error cancelling in Dodo:`, err.message);
  }

  // Update dodo_subscriptions table in Supabase
  const { error: subErr } = await supabase
    .from("dodo_subscriptions")
    .update({
      status: "cancelled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", soloSubscriptionId);

  if (subErr) {
    console.error(`[Remediation] Error updating dodo_subscriptions:`, subErr);
  } else {
    console.log(`[Remediation] dodo_subscriptions updated for ${soloSubscriptionId} to cancelled.`);
  }

  // Ensure organization is locked to Scale
  const { error: orgErr } = await supabase
    .from("organizations")
    .update({
      plan_tier: "scale",
      dodo_subscription_id: scaleSubscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (orgErr) {
    console.error(`[Remediation] Error updating organization:`, orgErr);
  } else {
    console.log(`[Remediation] Organization ${orgId} verified as 'scale' with subscription ${scaleSubscriptionId}.`);
  }
}

remediate()
  .then(() => {
    console.log("[Remediation] Completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Remediation] Fatal error:", err);
    process.exit(1);
  });
