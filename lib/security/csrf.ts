/**
 * CSRF Defense Utility
 *
 * Enforces Origin and Sec-Fetch-Site validation on state-changing HTTP requests
 * in alignment with OWASP Cross-Site Request Forgery Prevention Cheat Sheet.
 */

export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validates incoming state-changing requests against CSRF attacks.
 *
 * 1. Rejects if Sec-Fetch-Site is 'cross-site'.
 * 2. If Origin header is present, ensures it matches the request host or configured APP_URL.
 * 3. If Origin is absent but Referer is present, ensures Referer host matches request host.
 */
export function verifyCsrf(request: Request): CsrfValidationResult {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return { valid: true };
  }

  const headers = request.headers;

  // 1. Sec-Fetch-Site check
  // Set by modern browsers automatically and cannot be spoofed by JavaScript.
  const secFetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    return { valid: false, error: "Cross-site request blocked" };
  }

  // Determine allowed hosts from request and environment
  const allowedHosts = new Set<string>();

  const hostHeader = headers.get("x-forwarded-host") || headers.get("host");
  if (hostHeader) {
    allowedHosts.add(hostHeader.toLowerCase().trim());
  }

  // Parse request URL if available
  try {
    const reqUrl = new URL(request.url);
    if (reqUrl.host) {
      allowedHosts.add(reqUrl.host.toLowerCase().trim());
    }
  } catch {
    // Ignore invalid request.url
  }

  // App URL from environment
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const parsedAppUrl = new URL(appUrl);
      if (parsedAppUrl.host) {
        allowedHosts.add(parsedAppUrl.host.toLowerCase().trim());
      }
    } catch {
      // Ignore invalid NEXT_PUBLIC_APP_URL
    }
  }

  // 2. Origin header check
  const origin = headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!originUrl.host || !["http:", "https:"].includes(originUrl.protocol)) {
        return { valid: false, error: "Malformed origin header" };
      }
      const originHost = originUrl.host.toLowerCase().trim();

      if (allowedHosts.size > 0 && !allowedHosts.has(originHost)) {
        return { valid: false, error: "Origin mismatch" };
      }
    } catch {
      return { valid: false, error: "Malformed origin header" };
    }
  }

  // 3. Referer fallback check (if Origin header is absent)
  const referer = headers.get("referer");
  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer);
      if (!refererUrl.host || !["http:", "https:"].includes(refererUrl.protocol)) {
        return { valid: false, error: "Malformed referer header" };
      }
      const refererHost = refererUrl.host.toLowerCase().trim();

      if (allowedHosts.size > 0 && !allowedHosts.has(refererHost)) {
        return { valid: false, error: "Referer mismatch" };
      }
    } catch {
      return { valid: false, error: "Malformed referer header" };
    }
  }

  return { valid: true };
}
