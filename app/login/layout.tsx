import type { Metadata } from "next";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPublicMetadata({
  title: "Log In",
  description:
    "Log in to your SalesChat workspace to practice live sales conversations and review AI coaching feedback.",
  path: "/login",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
