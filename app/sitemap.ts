import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";
import {
  getRoutePolicy,
  isPublicSitemapRoute,
  CORE_SITEMAP_FALLBACK_ROUTES,
} from "@/lib/seo/sitemap-config";

export const dynamic = "force-static";
export const revalidate = 86400;

interface DiscoveredRoute {
  route: string;
  lastModified: Date;
}

/**
 * Recursively scans Next.js App Router directory to discover valid page routes
 * along with their actual filesystem modification timestamps.
 */
function discoverAppRoutes(
  currentDir: string = path.join(process.cwd(), "app"),
  currentRoute: string = ""
): DiscoveredRoute[] {
  let discovered: DiscoveredRoute[] = [];

  if (!fs.existsSync(currentDir)) {
    return discovered;
  }

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Route groups like (marketing) do not affect the public URL path
      if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
        discovered = discovered.concat(discoverAppRoutes(fullPath, currentRoute));
      } else {
        const nextSegment = currentRoute ? `${currentRoute}/${entry.name}` : `/${entry.name}`;
        discovered = discovered.concat(discoverAppRoutes(fullPath, nextSegment));
      }
    } else if (
      entry.isFile() &&
      (entry.name === "page.tsx" || entry.name === "page.jsx" || entry.name === "page.js")
    ) {
      try {
        const stat = fs.statSync(fullPath);
        discovered.push({
          route: currentRoute || "/",
          lastModified: stat.mtime,
        });
      } catch {
        discovered.push({
          route: currentRoute || "/",
          lastModified: new Date(),
        });
      }
    }
  }

  return discovered;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat2sell.in";
  let discoveredRoutes: DiscoveredRoute[] = [];

  try {
    discoveredRoutes = discoverAppRoutes();
  } catch (err) {
    // Graceful fallback if filesystem access is restricted
    console.warn("[Sitemap] Filesystem discovery error, falling back to core catalog:", err);
  }

  // If filesystem discovery returned empty (e.g. edge environment), use fallback catalog
  if (discoveredRoutes.length === 0) {
    const fallbackDate = new Date();
    discoveredRoutes = CORE_SITEMAP_FALLBACK_ROUTES.map((route) => ({
      route,
      lastModified: fallbackDate,
    }));
  }

  // Filter out non-public/protected routes and map to sitemap entries
  const sitemapEntries = discoveredRoutes
    .filter((entry) => isPublicSitemapRoute(entry.route))
    .map((entry) => {
      const policy = getRoutePolicy(entry.route);
      return {
        url: entry.route === "/" ? siteUrl : `${siteUrl}${entry.route}`,
        lastModified: entry.lastModified,
        changeFrequency: policy.changeFrequency,
        priority: policy.priority,
      };
    });

  // Sort by priority descending, then by url ascending for deterministic output
  return sitemapEntries.sort((a, b) => {
    if (b.priority !== a.priority) {
      return (b.priority ?? 0.5) - (a.priority ?? 0.5);
    }
    return a.url.localeCompare(b.url);
  });
}
