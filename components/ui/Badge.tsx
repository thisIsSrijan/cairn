import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "verified" | "caution" | "reject" | "neutral";
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  ...props
}) => {
  const variantStyles = {
    verified: "text-verified border-verified/50 bg-paper",
    caution: "text-caution border-caution/50 bg-paper",
    reject: "text-reject border-reject/50 bg-paper",
    neutral: "text-ink-soft border-rule bg-paper",
  }[variant];

  const dotColor = {
    verified: "bg-verified",
    caution: "bg-caution",
    reject: "bg-reject",
    neutral: "bg-ink-soft",
  }[variant];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded-xs border select-none ${variantStyles} ${className}`.trim()}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
