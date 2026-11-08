import fs from "fs";
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

const dodoApiKey = env.DODO_PAYMENTS_API_KEY;
const dodoEnv = (env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode";

const client = new DodoPayments({
  bearerToken: dodoApiKey,
  environment: dodoEnv,
});

async function setupProductCollection() {
  console.log("[ProductCollection] Checking existing product collections in Dodo...");
  const existing = await client.productCollections.list();
  const existingItems = (existing as any).items || (existing as any).data || [];

  const found = existingItems.find(
    (c: any) => c.name === "Chat2Sell Subscriptions" || c.name === "Chat2Sell Plans"
  );

  if (found) {
    console.log(`[ProductCollection] Collection already exists: ${found.id} (${found.name})`);
    return found;
  }

  console.log("[ProductCollection] Creating 'Chat2Sell Subscriptions' product collection...");
  const collection = await client.productCollections.create({
    name: "Chat2Sell Subscriptions",
    description: "Chat2Sell practice simulation plans: Solo, Team, Scale",
    groups: [
      {
        group_name: "Plans",
        products: [
          { product_id: "pdt_0NrCqCpQLfiaQSDlhGxoC" }, // Solo
          { product_id: "pdt_0NrCqCw137x2o5PtfWW3E" }, // Team
          { product_id: "pdt_0NrCqD1GfGTlFxBTIfmdg" }, // Scale
        ],
      },
    ],
    effective_at_on_upgrade: "immediately",
    proration_billing_mode_on_upgrade: "prorated_immediately",
    effective_at_on_downgrade: "next_billing_date",
  });

  console.log(`[ProductCollection] Successfully created collection:`, collection.id);
  return collection;
}

setupProductCollection()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ProductCollection] Failed:", err);
    process.exit(1);
  });
