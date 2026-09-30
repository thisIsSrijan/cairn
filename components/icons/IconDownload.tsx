import type { SVGProps } from "react";

export function IconDownload({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
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
      <path d="M12 3v13m0 0-4-4m4 4 4-4M4 19h16" />
    </svg>
  );
}
