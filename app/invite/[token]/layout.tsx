import type { Metadata } from "next";
import { constructPrivateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPrivateMetadata(
  "Workspace Invitation",
  "Join your team workspace on Chat2Sell to participate in sales drills and view team performance analytics."
);

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
