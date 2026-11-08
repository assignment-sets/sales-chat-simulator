import React from "react";
import Image from "next/image";

export interface BrandLogoProps {
  /**
   * "icon": Transparent black speech bubble with C2S inside and protective perimeter rim
   * "circle": High-contrast circular framed badge for dark/light surfaces
   * "white": Inverted white bubble for dark cards or dark headers
   * "full": Horizontal lockup (bubble + wordmark + subtitle)
   */
  variant?: "icon" | "circle" | "white" | "full";
  /** Width / height in pixels (defaults to 32) */
  size?: number;
  className?: string;
  priority?: boolean;
  /** Set to true when paired with an adjacent text label to avoid duplicate screen reader readout */
  ariaHidden?: boolean;
}

export function BrandLogo({
  variant = "icon",
  size = 32,
  className = "",
  priority = false,
  ariaHidden = false,
}: BrandLogoProps) {
  if (variant === "full") {
    // 624x186 aspect ratio is ~3.35:1
    const width = Math.round(size * 3.355);
    return (
      <Image
        src="/brand/chat2sell-lockup-transparent.png"
        alt={ariaHidden ? "" : "Chat2Sell"}
        aria-hidden={ariaHidden ? true : undefined}
        width={width}
        height={size}
        className={`shrink-0 object-contain ${className}`}
        priority={priority}
      />
    );
  }

  const srcMap = {
    icon: "/brand/chat2sell-icon-transparent.png",
    circle: "/brand/chat2sell-icon-circle.png",
    white: "/brand/chat2sell-icon-white.png",
  };

  const src = srcMap[variant] || srcMap.icon;

  return (
    <Image
      src={src}
      alt={ariaHidden ? "" : "Chat2Sell"}
      aria-hidden={ariaHidden ? true : undefined}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
    />
  );
}
