import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { getActiveOrganization } from "@/lib/tenant";
import { hasFeature } from "@/lib/plans";
import { TeamDashboard } from "@/components/dashboard/TeamDashboard";
import { Badge } from "@/components/ui/Badge";

export default async function DashboardPage() {
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

  const canAccessDashboard = hasFeature(
    activeContext.organization.plan_tier,
    "team_dashboard"
  );

  if (!canAccessDashboard) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 text-center shadow-2xs space-y-4">
          <div className="w-11 h-11 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-base font-bold text-zinc-900">
                Team Oversight Dashboard
              </h2>
              <Badge variant="accent" className="text-[10px] px-2 py-0.5 uppercase tracking-wider">
                Pro
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Rep performance benchmarks, win-rate analytics, and transcript inspection are available on the Pro and Scale plans.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2.5">
            <Link
              href="/chats"
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200 transition-colors"
            >
              Back to Practice
            </Link>
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              View Plans & Pricing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <TeamDashboard />;
}
