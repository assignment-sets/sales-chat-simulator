import type { Metadata } from "next";
import { constructPrivateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPrivateMetadata(
  "Forgot Password",
  "Request a password reset link to regain access to your Chat2Sell workspace account."
);

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
