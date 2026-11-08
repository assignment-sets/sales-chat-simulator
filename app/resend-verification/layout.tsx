import type { Metadata } from "next";
import { constructPrivateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPrivateMetadata(
  "Resend Email Verification",
  "Request a fresh email verification link to activate your Chat2Sell workspace account."
);

export default function ResendVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
