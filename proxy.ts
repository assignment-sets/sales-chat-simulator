import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { verifyCsrf } from "@/lib/security/csrf";

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export async function proxy(request: NextRequest) {
  // Enforce CSRF defense on mutating API routes
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    MUTATING_METHODS.includes(request.method)
  ) {
    const csrf = verifyCsrf(request);
    if (!csrf.valid) {
      return NextResponse.json(
        {
          error: {
            message: "Cross-site request forbidden",
            code: "FORBIDDEN",
          },
        },
        { status: 403 }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/assets extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
