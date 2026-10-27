import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://saleschat.io";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login", "/terms", "/privacy"],
        disallow: ["/api/", "/chats/", "/dashboard/", "/settings/", "/auth/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
