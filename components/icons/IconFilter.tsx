import type { SVGProps } from "react";

export function IconFilter({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z" />
    </svg>
  );
}
