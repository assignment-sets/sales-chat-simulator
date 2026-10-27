import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex-1 h-full w-full flex items-center justify-center p-6 bg-zinc-50/50">
      <div className="max-w-md w-full bg-white border border-zinc-200/90 rounded-3xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-4 text-zinc-600">
          <Compass className="w-6 h-6" />
        </div>

        <span className="inline-block text-[11px] font-bold font-mono tracking-wider text-zinc-400 uppercase mb-1">
          404 Not Found
        </span>

        <h2 className="text-lg font-bold text-zinc-900 tracking-tight mb-1.5">
          Page not found
        </h2>

        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          The page or simulation you are looking for does not exist or may have been moved.
        </p>

        <div className="flex items-center justify-center gap-2.5">
          <Link href="/chats">
            <Button
              type="button"
              variant="primary"
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
