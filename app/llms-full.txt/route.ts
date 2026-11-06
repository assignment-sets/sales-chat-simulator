import { NextResponse } from "next/server";
import { LLMS_FULL_CONTENT } from "@/lib/seo/llms-full-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

  let body = LLMS_FULL_CONTENT;
  if (siteUrl !== "https://chat2sell.in") {
    body = body.replaceAll("https://chat2sell.in", siteUrl);
  }

  return new NextResponse(body.trim(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
