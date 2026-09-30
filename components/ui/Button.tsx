import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-medium select-none transition-all duration-fast cursor-pointer rounded-xs min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-signal text-black font-semibold hover:brightness-105 active:brightness-95 focus-visible:outline-signal border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
      secondary:
        "bg-transparent text-ink border border-ink hover:bg-ink/5 active:bg-ink/10 focus-visible:outline-ink",
      quiet:
        "bg-transparent text-ink-soft hover:text-ink hover:bg-ink/5 active:bg-ink/10 border border-transparent focus-visible:outline-ink",
    }[variant];

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 tracking-wide",
      md: "text-sm px-4 py-2 tracking-normal",
      lg: "text-base px-6 py-2.5 tracking-normal",
    }[size];

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`.trim()}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
