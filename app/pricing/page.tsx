import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getActiveOrganization } from "@/lib/tenant";
import { getStartOfCurrentMonthUTC } from "@/lib/entitlements";
import { cached } from "@/lib/cache";
import { pricingKey } from "@/lib/cache/keys";
import { CACHE_TTLS } from "@/lib/cache/policies";
import { PricingView } from "@/components/pricing/PricingView";

export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeContext = await getActiveOrganization(
    supabase,
    user.id,
    user.email
  );

  if (!activeContext) {
    redirect("/chats");
  }

  const { organization } = activeContext;
  const startOfMonth = getStartOfCurrentMonthUTC();

  // Org-scoped usage counters, cached briefly: every write that changes them
  // invalidates `pricingKey(orgId)`.
  const loadUsage = async () => {
    const [simsRes, membersRes, invitesRes] = await Promise.all([
      supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .gte("created_at", startOfMonth),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id),
      supabase
        .from("organization_invitations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id),
    ]);

    return {
      simulationsUsedThisMonth: simsRes.count ?? 0,
      seatsUsed: (membersRes.count ?? 0) + (invitesRes.count ?? 0),
    };
  };

  const { simulationsUsedThisMonth, seatsUsed } = await cached(
    pricingKey(organization.id),
    CACHE_TTLS.pricing,
    loadUsage
  );

  return (
    <PricingView
      organizationName={organization.name}
      currentTier={organization.plan_tier}
      simulationsUsedThisMonth={simulationsUsedThisMonth}
      seatsUsed={seatsUsed}
    />
  );
}
