import type { SVGProps } from "react";

export function IconShield({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <path d="M12 3s7 3 7 9c0 5-4 8-7 9-3-1-7-4-7-9 0-6 7-9 7-9Z" />
    </svg>
  );
}
