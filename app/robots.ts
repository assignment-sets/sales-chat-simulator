import type { MetadataRoute } from "next";

export const dynamic = "force-static";
export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";

  const publicRoutes = ["/", "/pricing", "/login", "/terms", "/privacy", "/cookies", "/support"];
  const protectedRoutes = [
    "/api/",
    "/chats/",
    "/dashboard/",
    "/settings/",
    "/auth/",
    "/invite/",
    "/reset-password",
    "/forgot-password",
    "/resend-verification",
  ];

  return {
    rules: [
      {
        userAgent: [
          "OAI-SearchBot",
          "PerplexityBot",
          "Claude-SearchBot",
          "Applebot-Extended",
        ],
        allow: publicRoutes,
        disallow: protectedRoutes,
      },
      {
        userAgent: "*",
        allow: publicRoutes,
        disallow: protectedRoutes,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
