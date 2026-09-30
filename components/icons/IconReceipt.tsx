import type { SVGProps } from "react";

export function IconReceipt({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 3v18l3.5-2 3.5 2 3.5-2 3.5 2V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
