import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { LandingHero } from "@/components/landing/LandingHero";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPublicMetadata({
  title: "AI Sales Practice Simulator",
  description:
    "Sharpen your live chat sales skills against hyper-realistic AI prospect personas with instant coaching feedback.",
  path: "/",
});

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
