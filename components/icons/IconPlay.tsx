import type { SVGProps } from "react";

export function IconPlay({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <polygon points="7,4 20,12 7,20" />
    </svg>
  );
}
