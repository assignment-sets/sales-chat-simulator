import { Loader } from "@/components/ui/Loader";

export default function PricingLoading() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <Loader size="md" label="Loading plans & usage..." />
    </div>
  );
}
