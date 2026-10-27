import { createServerSupabaseClient } from "@/utils/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { getActiveOrganization } from "@/lib/tenant";

export default async function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-full flex flex-col bg-white text-zinc-900 font-sans overflow-y-auto">
        {children}
      </div>
    );
  }

  const userName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    undefined;

  const activeContext = await getActiveOrganization(
    supabase,
    user.id,
    user.email,
    userName
  );

  if (!activeContext) {
    return (
      <div className="min-h-full flex flex-col bg-white text-zinc-900 font-sans overflow-y-auto">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen h-dvh max-h-screen bg-white text-zinc-900 flex flex-col font-sans overflow-hidden">
      <Navbar
        userEmail={user.email}
        userName={userName}
        activeOrg={activeContext.organization}
        activeRole={activeContext.role}
        organizations={activeContext.allOrganizations}
        isDashboard={false}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-zinc-50/50 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
