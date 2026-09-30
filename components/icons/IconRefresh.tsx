import type { SVGProps } from "react";

export function IconRefresh({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <path d="M21 4v6h-6M3 20v-6h6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L21 10" />
    </svg>
  );
}
