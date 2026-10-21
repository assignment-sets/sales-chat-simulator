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

  // Resolve active organization context
  const activeContext = await getActiveOrganization(
    supabase,
    user.id,
    user.email
  );

  let chatsQuery = supabase
    .from("chats")
    .select("id, product_name, created_at, organization_id, user_id")
    .order("created_at", { ascending: false });

  if (activeContext) {
    chatsQuery = chatsQuery.eq("organization_id", activeContext.organization.id);
    // Regular members only see their own simulations in the sidebar
    if (activeContext.role === "member") {
      chatsQuery = chatsQuery.eq("user_id", user.id);
    }
  } else {
    chatsQuery = chatsQuery.eq("user_id", user.id);
  }

  const { data: chats } = await chatsQuery;

  return (
    <AppShell
      userEmail={user.email}
      chats={chats || []}
      activeOrg={activeContext?.organization}
      activeRole={activeContext?.role}
      organizations={activeContext?.allOrganizations || []}
    >
      {children}
    </AppShell>
  );
}
