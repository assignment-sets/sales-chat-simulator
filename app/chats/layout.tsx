import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

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

  const { data: chats } = await supabase
    .from("chats")
    .select("id, product_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <AppShell userEmail={user.email} chats={chats || []}>
      {children}
    </AppShell>
  );
}
