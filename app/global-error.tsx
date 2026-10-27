"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="h-full min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans antialiased text-zinc-900">
        <div className="max-w-md w-full bg-white border border-zinc-200/90 rounded-3xl p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 mb-2 tracking-tight">
            Application Error
          </h2>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
            A critical error interrupted the application layout. Please reload to restore your session.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 active:bg-zinc-950 transition-colors cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
