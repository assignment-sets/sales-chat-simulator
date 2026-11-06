import type { Metadata } from "next";
import { constructPublicMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructPublicMetadata({
  title: "Create an Account",
  description:
    "Create your SalesChat account to sharpen sales objection handling against realistic AI prospect personas.",
  path: "/register",
});

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
