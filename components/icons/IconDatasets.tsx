import type { SVGProps } from "react";

export function IconDatasets({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 10v10" />
    </svg>
  );
}
