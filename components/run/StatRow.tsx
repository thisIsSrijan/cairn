"use client";

import React from "react";
import type { RunCounts } from "@/lib/db/schemas";

export interface StatRowProps {
  counts: RunCounts;
  className?: string;
}

export const StatRow: React.FC<StatRowProps> = ({ counts, className = "" }) => {
  const stats = [
    {
      id: "sources-found",
      label: "Sources Found",
      value: counts.sourcesFound,
      highlight: false,
    },
    {
      id: "sources-fetched",
      label: "Fetched",
      value: counts.sourcesFetched,
      highlight: false,
    },
    {
      id: "values-extracted",
      label: "Values Extracted",
      value: counts.valuesExtracted,
      highlight: false,
    },
    {
      id: "values-rejected",
      label: "Rejected",
      value: counts.valuesRejected,
      highlight: counts.valuesRejected > 0,
      variant: "reject" as const,
    },
    {
      id: "records-kept",
      label: "Records Kept",
      value: counts.recordsKept,
      highlight: counts.recordsKept > 0,
      variant: "signal" as const,
    },
    {
      id: "duplicates-merged",
      label: "Duplicates Merged",
      value: counts.duplicatesMerged,
      highlight: false,
    },
  ];

  return (
    <div
      aria-label="Collection Run Statistics"
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 ${className}`.trim()}
    >
      {stats.map((stat) => (
        <div
          key={stat.id}
          className={`p-2.5 sm:p-3 border rounded-xs transition-colors duration-fast ${
            stat.highlight && stat.variant === "reject"
              ? "bg-reject/5 border-reject/40 text-reject"
              : stat.highlight && stat.variant === "signal"
              ? "bg-paper-2 border-signal/40 text-ink"
              : "bg-paper-2/60 border-rule text-ink"
          }`}
        >
          <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-soft select-none truncate">
            {stat.label}
          </div>
          <div
            className={`font-mono text-lg sm:text-xl font-semibold tabular-nums mt-0.5 ${
              stat.highlight && stat.variant === "reject"
                ? "text-reject"
                : stat.highlight && stat.variant === "signal"
                ? "text-signal"
                : "text-ink"
            }`}
          >
            {stat.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};
