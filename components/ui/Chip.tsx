import React from "react";
import { IconClose } from "@/components/icons/IconClose";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      label,
      selected = false,
      onRemove,
      icon,
      className = "",
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-xs border transition-colors duration-fast select-none min-h-[32px]";

    const stateStyles = selected
      ? "bg-ink text-paper border-ink"
      : "bg-paper-2 text-ink border-rule hover:border-ink-soft";

    if (onRemove) {
      return (
        <span
          className={`${baseStyles} ${stateStyles} ${className}`.trim()}
        >
          {icon && <span className="inline-flex shrink-0">{icon}</span>}
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className="cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit select-none focus-visible:outline-2 focus-visible:outline-signal"
            {...props}
          >
            {label}
          </button>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 -mr-1 inline-flex h-4 w-4 items-center justify-center rounded-xs text-ink-soft hover:bg-ink/10 hover:text-ink transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal"
          >
            <IconClose className="h-3 w-3" />
          </button>
        </span>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`${baseStyles} ${stateStyles} cursor-pointer focus-visible:outline-2 focus-visible:outline-signal ${className}`.trim()}
        {...props}
      >
        {icon && <span className="inline-flex shrink-0">{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }
);

Chip.displayName = "Chip";
