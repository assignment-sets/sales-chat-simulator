export type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface RouteMetadataPolicy {
  priority: number;
  changeFrequency: ChangeFrequency;
}

/**
 * Route patterns or exact paths excluded from public sitemap indexing.
 * Aligned with robots.ts protected routes and redirection endpoints.
 */
export const SITEMAP_EXCLUDED_PREFIXES: string[] = [
  "/api",
  "/chats",
  "/dashboard",
  "/settings",
  "/auth",
  "/invite",
  "/reset-password",
  "/forgot-password",
  "/resend-verification",
  "/aup",
  "/trust",
  "/contact",
  "/cancellation",
];

/**
 * Priority and changeFrequency mappings for public routes.
 */
export const ROUTE_POLICIES: Record<string, RouteMetadataPolicy> = {
  "/": {
    priority: 1.0,
    changeFrequency: "weekly",
  },
  "/pricing": {
    priority: 0.8,
    changeFrequency: "weekly",
  },
  "/about": {
    priority: 0.7,
    changeFrequency: "monthly",
  },
  "/docs": {
    priority: 0.7,
    changeFrequency: "weekly",
  },
  "/changelog": {
    priority: 0.6,
    changeFrequency: "weekly",
  },
  "/support": {
    priority: 0.5,
    changeFrequency: "monthly",
  },
  "/login": {
    priority: 0.5,
    changeFrequency: "monthly",
  },
  "/register": {
    priority: 0.5,
    changeFrequency: "monthly",
  },
  "/terms": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/privacy": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/acceptable-use": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/security": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/subprocessors": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/cookies": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
  "/refund": {
    priority: 0.3,
    changeFrequency: "monthly",
  },
};

export const DEFAULT_ROUTE_POLICY: RouteMetadataPolicy = {
  priority: 0.5,
  changeFrequency: "monthly",
};

/**
 * Resolves SEO metadata policy for a given normalized route path.
 */
export function getRoutePolicy(route: string): RouteMetadataPolicy {
  return ROUTE_POLICIES[route] ?? DEFAULT_ROUTE_POLICY;
}

/**
 * Determines whether a route is permitted in the public sitemap.
 */
export function isPublicSitemapRoute(route: string): boolean {
  // Exclude routes containing dynamic segments e.g. [id], [token]
  if (/\[.+\]/.test(route)) {
    return false;
  }

  // Exclude protected or internal route prefixes
  for (const prefix of SITEMAP_EXCLUDED_PREFIXES) {
    if (route === prefix || route.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  return true;
}

/**
 * Fallback static catalog if filesystem exploration is unavailable in edge runtimes.
 */
export const CORE_SITEMAP_FALLBACK_ROUTES: string[] = [
  "/",
  "/pricing",
  "/about",
  "/docs",
  "/changelog",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/acceptable-use",
  "/security",
  "/subprocessors",
  "/cookies",
  "/refund",
  "/support",
];
