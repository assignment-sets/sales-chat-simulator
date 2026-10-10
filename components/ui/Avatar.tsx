import React from "react";

export interface AvatarProps {
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name = "U", size = "md", className = "" }: AvatarProps) {
  const initial = (name || "U").trim().charAt(0).toUpperCase();

  const sizeStyles = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-11 h-11 text-base",
  };

  return (
    <div
      className={`rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold flex items-center justify-center select-none shrink-0 ${sizeStyles[size]} ${className}`}
      title={name}
    >
      {initial}
    </div>
  );
}
