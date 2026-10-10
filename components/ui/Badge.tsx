import React from "react";

export type BadgeVariant = "default" | "accent" | "success" | "muted";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  children,
  variant = "default",
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    accent: "bg-blue-50 text-blue-700 border border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    muted: "bg-zinc-50 text-zinc-500 border border-zinc-200/60",
  };

  return (
    <span
      className={`inline-flex flex-row items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 [&_svg]:shrink-0 [&_svg]:inline-block ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
