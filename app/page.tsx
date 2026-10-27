import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { LandingHero } from "@/components/landing/LandingHero";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chats");
  }

  return <LandingHero />;
}
