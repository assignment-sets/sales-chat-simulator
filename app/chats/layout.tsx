import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { getActiveOrganization } from "@/lib/tenant";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    undefined;

  // Resolve active organization context
  const activeContext = await getActiveOrganization(
    supabase,
    user.id,
    user.email,
    userName
  );

  let chatsQuery = supabase
    .from("chats")
    .select("id, product_name, created_at, organization_id, user_id")
    .order("created_at", { ascending: false });

  if (activeContext) {
    // Personal practice sidebar: every user strictly sees their own simulations in the active org
    chatsQuery = chatsQuery
      .eq("organization_id", activeContext.organization.id)
      .eq("user_id", user.id);
  } else {
    chatsQuery = chatsQuery.eq("user_id", user.id);
  }

  const { data: chats } = await chatsQuery;

  return (
    <AppShell
      userEmail={user.email}
      userName={userName}
      chats={chats || []}
      activeOrg={activeContext?.organization}
      activeRole={activeContext?.role}
      organizations={activeContext?.allOrganizations || []}
    >
      {children}
    </AppShell>
  );
}
