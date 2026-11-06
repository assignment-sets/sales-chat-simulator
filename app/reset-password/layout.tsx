import type { Metadata } from "next";
import { constructPrivateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPrivateMetadata(
  "Reset Password",
  "Set a new secure password for your SalesChat workspace account."
);

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
