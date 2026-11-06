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
    accent: "bg-zinc-100 text-zinc-900 border border-zinc-200",
    success: "bg-zinc-100 text-zinc-800 border border-zinc-200",
    muted: "bg-zinc-50 text-zinc-500 border border-zinc-200/60",
  };

  return (
    <span
      className={`inline-flex flex-row items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 [&_svg]:shrink-0 [&_svg]:inline-block ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
