import type { SVGProps } from "react";

interface IconChevronProps extends SVGProps<SVGSVGElement> {
  direction?: "up" | "down" | "left" | "right";
}

export function IconChevron({
  direction = "right",
  className = "w-5 h-5",
  ...props
}: IconChevronProps) {
  const rotation = {
    right: "",
    down: "rotate-90",
    left: "rotate-180",
    up: "-rotate-90",
  }[direction];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${rotation} ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
