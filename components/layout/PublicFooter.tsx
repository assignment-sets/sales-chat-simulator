import React from "react";
import Link from "next/link";
import { Bot, ShieldCheck } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white py-12 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-zinc-100">
          {/* Column 1: Brand & Identity */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-zinc-900 text-sm tracking-tight"
            >
              <div className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                <Bot className="w-3.5 h-3.5 text-zinc-100" />
              </div>
              <span>SalesChat</span>
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Realistic sales chat simulations and objection coaching for revenue teams.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900">Product</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li>
                <Link href="/pricing" className="hover:text-zinc-900 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-zinc-900 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-zinc-900 transition-colors">
                  Changelog
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-zinc-900 transition-colors">
                  Support & Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900">Trust & Security</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li>
                <Link href="/security" className="hover:text-zinc-900 transition-colors">
                  Security Overview
                </Link>
              </li>
              <li>
                <Link href="/subprocessors" className="hover:text-zinc-900 transition-colors">
                  Subprocessors
                </Link>
              </li>
              <li>
                <Link href="/acceptable-use" className="hover:text-zinc-900 transition-colors">
                  Acceptable Use Policy
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-zinc-900 transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900">Legal</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li>
                <Link href="/terms" className="hover:text-zinc-900 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-zinc-900 transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-zinc-900 transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-zinc-900 transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <span>© {new Date().getFullYear()} SalesChat. All rights reserved.</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>TLS 1.3 · AES-256 · Multi-Tenant Isolation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
