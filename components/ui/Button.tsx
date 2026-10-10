import React, { forwardRef } from "react";

import { Loader } from "@/components/ui/Loader";

export type ButtonVariant = "primary" | "outline" | "soft" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "pill" | "rounded";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      shape = "pill",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex flex-row items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer whitespace-nowrap shrink-0 [&_svg]:shrink-0 [&_svg]:inline-block";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950",
      outline: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100",
      soft: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300",
      destructive: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:bg-red-200",
      ghost: "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    const shapeStyles: Record<ButtonShape, string> = {
      pill: "rounded-full",
      rounded: "rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${shapeStyles[shape]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-flex items-center">
            <Loader size="sm" dotClassName="bg-current" />
          </span>
        )}
        {!isLoading && leftIcon && (
          <span className="inline-flex shrink-0 items-center justify-center">
            {leftIcon}
          </span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center justify-center">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
