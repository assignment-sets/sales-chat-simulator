import React from "react";

export interface LoaderProps {
  size?: "sm" | "md" | "lg";
  overlay?: boolean;
  label?: string;
  className?: string;
  dotClassName?: string;
}

const sizeMap = {
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
};

const dotSizeMap = {
  sm: "w-1.5 h-1.5",
  md: "w-2.5 h-2.5",
  lg: "w-3.5 h-3.5",
};

export function Loader({
  size = "md",
  overlay = false,
  label,
  className = "",
  dotClassName = "bg-zinc-900",
}: LoaderProps) {
  const dots = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`inline-flex items-center ${sizeMap[size]}`}>
        <span
          className={`${dotSizeMap[size]} rounded-full ${dotClassName} animate-dot-1 shrink-0 inline-block`}
        />
        <span
          className={`${dotSizeMap[size]} rounded-full ${dotClassName} animate-dot-2 shrink-0 inline-block`}
        />
        <span
          className={`${dotSizeMap[size]} rounded-full ${dotClassName} animate-dot-3 shrink-0 inline-block`}
        />
      </div>
      {label && (
        <span className="mt-2 text-xs font-medium text-zinc-500 select-none">
          {label}
        </span>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/70 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150">
        {dots}
      </div>
    );
  }

  return dots;
}
