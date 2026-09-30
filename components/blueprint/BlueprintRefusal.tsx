import React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { PlannerRefusal } from "@/lib/llm/planner";

export interface BlueprintRefusalProps {
  refusal: PlannerRefusal & {
    refusedCategories?: string[];
  };
  onClose: () => void;
}

export const BlueprintRefusal: React.FC<BlueprintRefusalProps> = ({
  refusal,
  onClose,
}) => {
  const categories = refusal.refusedCategories ?? ["Personal Contact Information"];

  return (
    <div className="space-y-6 py-2">
      {/* Refusal Illustration: Cairn stone boundary marker */}
      <div className="flex justify-center py-2" aria-hidden="true">
        <svg
          viewBox="0 0 160 100"
          className="w-36 h-24 text-ink-soft"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ground contour */}
          <path
            d="M 10 85 Q 80 82 150 86"
            stroke="var(--color-rule)"
            strokeWidth="1.5"
          />
          {/* Cairn stone marker boundary */}
          <rect
            x="50"
            y="64"
            width="60"
            height="18"
            rx="3"
            fill="var(--color-paper-2)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="60"
            y="48"
            width="40"
            height="16"
            rx="3"
            fill="var(--color-paper-2)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="80"
            cy="36"
            r="8"
            fill="var(--color-reject)"
            fillOpacity="0.15"
            stroke="var(--color-reject)"
            strokeWidth="1.5"
          />
          {/* Boundary diagonal slash across top stone */}
          <line
            x1="74"
            y1="30"
            x2="86"
            y2="42"
            stroke="var(--color-reject)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="text-center space-y-2">
        <div className="font-mono text-xs uppercase tracking-wider text-reject font-semibold">
          Request Refused
        </div>
        <h3 className="font-display text-xl text-ink font-medium">
          Collection policy boundary reached
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed max-w-md mx-auto">
          {refusal.reason}
        </p>
      </div>

      {categories.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="font-mono text-xs uppercase tracking-wider text-ink-soft text-center">
            Restricted Categories
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Badge key={cat} variant="reject">
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-rule flex justify-center">
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          Revise Request
        </Button>
      </div>
    </div>
  );
};
