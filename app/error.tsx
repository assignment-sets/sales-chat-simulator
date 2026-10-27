"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex-1 h-full w-full flex items-center justify-center p-6 bg-zinc-50/50">
      <div className="max-w-md w-full bg-white border border-zinc-200/90 rounded-3xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4 text-red-600">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-zinc-900 tracking-tight mb-1.5">
          Something went wrong
        </h2>

        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          An unexpected error occurred while rendering this page. You can try reloading or return to your simulations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => reset()}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Try Again
          </Button>

          <Link href="/chats">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Practice
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
