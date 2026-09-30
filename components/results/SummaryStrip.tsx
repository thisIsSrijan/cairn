import React from "react";
import type { RunCounts } from "@/lib/db/schemas";

export interface SummaryStripProps {
  counts: RunCounts;
}

export const SummaryStrip: React.FC<SummaryStripProps> = ({ counts }) => {
  const verified = counts.verified || 0;
  const caution = counts.unverified || 0;
  const rejected = counts.valuesRejected || 0;
  const recordsTotal = verified + caution;

  const verifiedPct = recordsTotal > 0 ? Math.round((verified / recordsTotal) * 100) : 0;
  const cautionPct = recordsTotal > 0 ? Math.round((caution / recordsTotal) * 100) : 0;
  const rejectPct = recordsTotal > 0 && rejected > 0 ? Math.min(20, Math.round((rejected / (recordsTotal + rejected)) * 100)) : 0;

  return (
    <section
      aria-label="Collection summary metrics"
      className="bg-paper-2 border border-rule rounded-xs p-4 sm:p-5 space-y-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
        {/* Records Kept */}
        <div className="space-y-1">
          <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-soft block">
            Records Kept
          </span>
          <span className="font-mono text-2xl sm:text-3xl text-ink font-semibold tabular-nums block">
            {counts.recordsKept || 0}
          </span>
        </div>

        {/* Verified Share */}
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-soft">
              Verified Share
            </span>
            <span className="font-mono text-xs text-ink font-medium tabular-nums">
              {verifiedPct}% verified
            </span>
          </div>

          {/* Segmented rule */}
          <div
            role="progressbar"
            aria-valuenow={verifiedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Verified evidence share"
            className="h-2 w-full bg-rule/40 rounded-full flex overflow-hidden"
          >
            {verifiedPct > 0 && (
              <div
                style={{ width: `${verifiedPct}%` }}
                className="bg-cairn-verified h-full transition-all duration-medium"
                title={`${verifiedPct}% verified`}
              />
            )}
            {cautionPct > 0 && (
              <div
                style={{ width: `${cautionPct}%` }}
                className="bg-cairn-caution h-full transition-all duration-medium"
                title={`${cautionPct}% unverified`}
              />
            )}
            {rejectPct > 0 && (
              <div
                style={{ width: `${rejectPct}%` }}
                className="bg-cairn-reject h-full transition-all duration-medium"
                title={`${rejectPct}% rejected`}
              />
            )}
          </div>
        </div>

        {/* Duplicates Merged */}
        <div className="space-y-1">
          <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-soft block">
            Duplicates Merged
          </span>
          <span className="font-mono text-2xl sm:text-3xl text-ink font-semibold tabular-nums block">
            {counts.duplicatesMerged || 0}
          </span>
        </div>

        {/* Rejected Values */}
        <div className="space-y-1">
          <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-soft block">
            Rejected Values
          </span>
          <span className="font-mono text-2xl sm:text-3xl text-ink font-semibold tabular-nums block">
            {counts.valuesRejected || 0}
          </span>
        </div>
      </div>
    </section>
  );
};
