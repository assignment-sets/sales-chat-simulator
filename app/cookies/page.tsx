import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie Policy for SalesChat detailing essential cookies, authentication session storage, and our zero-tracking commitment.",
};

interface CookieItem {
  name: string;
  provider: string;
  purpose: string;
  type: string;
  duration: string;
}

const ESSENTIAL_COOKIES: CookieItem[] = [
  {
    name: "sb-*-auth-token",
    provider: "Supabase Auth (@supabase/ssr)",
    purpose: "Maintains secure user authentication sessions, JWT tokens, and token refresh across page navigations.",
    type: "Strictly Necessary / Essential",
    duration: "Session / Refresh Token Lifetime",
  },
  {
    name: "sc_active_org_id",
    provider: "SalesChat (First-Party)",
    purpose: "Stores the identifier of the active organization workspace so you remain in your chosen team context.",
    type: "Strictly Necessary / Functional",
    duration: "30 Days (HttpOnly, SameSite=Lax, Secure)",
  },
];

export default function CookiePage() {
  return (
    <LegalPageShell
      title="Cookie Policy"
      subtitle="How SalesChat utilizes essential cookies for authentication and workspace security."
      lastUpdated="October 2026"
    >
      {/* Commitment Highlight Callout */}
      <section className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 text-emerald-950 not-prose">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-emerald-900">
              Our Zero-Tracking Commitment
            </h2>
            <p className="text-xs leading-relaxed text-emerald-900/90">
              SalesChat does not use advertising cookies, marketing pixels, social media widgets, or cross-site behavioral trackers. We deploy only strictly necessary cookies required to authenticate your account and ensure secure workspace operation.
            </p>
          </div>
        </div>
      </section>

      {/* 1. What Are Cookies */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          1. What Are Cookies?
        </h2>
        <p>
          Cookies are small text files placed on your device when you visit a website. They allow web applications to identify your browser session, remember your login state, and maintain secure access to your account and workspace data as you navigate between pages.
        </p>
      </section>

      {/* 2. Essential Cookies Used */}
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          2. Essential Cookies We Use
        </h2>
        <p>
          Because our cookies are strictly necessary to deliver the simulation platform, they do not require prior consent under Article 5(3) of the EU ePrivacy Directive and GDPR. The table below lists all cookies deployed on SalesChat:
        </p>

        <div className="overflow-x-auto border border-zinc-200/90 rounded-2xl not-prose bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100/70 text-zinc-700 font-semibold border-b border-zinc-200">
                <th className="py-3 px-4">Cookie Name</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration & Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-600">
              {ESSENTIAL_COOKIES.map((cookie) => (
                <tr key={cookie.name} className="hover:bg-zinc-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-zinc-900 text-[11px]">
                    {cookie.name}
                  </td>
                  <td className="py-3 px-4">{cookie.provider}</td>
                  <td className="py-3 px-4">{cookie.purpose}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                      {cookie.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                    {cookie.duration}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Third-Party Tracking & Advertising */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          3. Third-Party Analytics & Advertising Cookies
        </h2>
        <p>
          SalesChat does <strong>not</strong> install or permit third-party advertising cookies, ad exchanges, or behavioral profiling trackers on our platform. We do not monetize your data, sell personal information, or share browsing patterns with data brokers.
        </p>
        <p>
          Simulation performance metrics, win/loss stats, and feedback scores displayed in your team dashboard are computed directly from your workspace records via database queries; they do not involve browser-level tracking beacons.
        </p>
      </section>

      {/* 4. Local Storage & Preferences */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          4. Local Storage & Client-Side Preferences
        </h2>
        <p>
          In addition to HTTP cookies, the platform may use browser local storage (<code>localStorage</code>) to persist client-side UI states—such as collapsed navigation bars, notification dismissals, or toast alerts—for responsive user experience. No personal identifying information or credentials are stored unencrypted in client local storage.
        </p>
      </section>

      {/* 5. Managing & Disabling Cookies */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          5. How to Control or Disable Cookies
        </h2>
        <p>
          Most web browsers allow you to modify cookie preferences through browser settings. You can choose to block or delete cookies in your browser settings (Chrome, Safari, Firefox, Edge, etc.).
        </p>
        <p className="text-zinc-500 italic">
          <strong>Important:</strong> Because all cookies deployed by SalesChat are strictly necessary for authentication and session management, blocking or disabling them will prevent you from signing in and using the simulation application.
        </p>
      </section>

      {/* 6. Contact */}
      <section className="space-y-3 border-t border-zinc-200/80 pt-6">
        <h2 className="text-base sm:text-lg font-bold text-zinc-900">
          6. Contact & Inquiries
        </h2>
        <p>
          If you have any questions regarding our use of cookies or privacy practices, please contact us at{" "}
          <a href="mailto:privacy@chat2sell.in" className="text-zinc-900 underline font-medium">
            privacy@chat2sell.in
          </a>{" "}
          or review our{" "}
          <Link href="/privacy" className="text-zinc-900 underline font-medium">
            Privacy Policy
          </Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}
