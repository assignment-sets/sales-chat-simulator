import { Loader } from "@/components/ui/Loader";

export default function Loading() {
  return (
    <div className="flex-1 h-full w-full flex items-center justify-center p-8 bg-zinc-50/50">
      <Loader size="lg" label="Loading..." />
    </div>
  );
}
