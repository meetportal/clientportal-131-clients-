import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-200 disabled:bg-indigo-300 disabled:shadow-none",
  secondary:
    "bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 border border-gray-200 shadow-sm disabled:opacity-50",
  ghost:
    "bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-700 disabled:opacity-40",
  danger:
    "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-md shadow-red-200 disabled:opacity-50",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export function Button({
  isLoading = false,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none",
        "focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}
