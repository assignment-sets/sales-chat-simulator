import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getActiveOrganization } from "@/lib/tenant";
import { getStartOfCurrentMonthUTC } from "@/lib/entitlements";
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

  // Fetch current month simulation count and current seat count in parallel
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

  const simulationsUsedThisMonth = simsRes.count ?? 0;
  const seatsUsed = (membersRes.count ?? 0) + (invitesRes.count ?? 0);

  return (
    <PricingView
      organizationName={organization.name}
      currentTier={organization.plan_tier}
      simulationsUsedThisMonth={simulationsUsedThisMonth}
      seatsUsed={seatsUsed}
    />
  );
}
