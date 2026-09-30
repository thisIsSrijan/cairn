import type { SVGProps } from "react";

export function CairnMark({ className = "w-6 h-6", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="7" y="43" width="50" height="14" rx="7" fill="currentColor" />
      <rect
        x="16"
        y="26"
        width="33"
        height="13"
        rx="6.5"
        fill="currentColor"
        transform="rotate(-3 32 32)"
      />
      <circle
        cx="33"
        cy="13"
        r="7"
        className="fill-signal"
        style={{ fill: "var(--cairn-signal, #D9482B)" }}
      />
    </svg>
  );
}
