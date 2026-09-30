"use client";

import React from "react";
import type { RecordDoc } from "@/lib/db/schemas";
import { IconCheck } from "@/components/icons/IconCheck";
import { IconFlag } from "@/components/icons/IconFlag";
import { IconSource } from "@/components/icons/IconSource";
import { Badge } from "@/components/ui/Badge";

export interface SpecimenCardProps {
  record: RecordDoc & { id: string };
  fields: Array<{ key: string; label: string }>;
  keyField?: string;
  sourceDomain?: string;
  onSelectReceipt: (record: RecordDoc & { id: string }, field: string) => void;
}

export const SpecimenCard: React.FC<SpecimenCardProps> = ({
  record,
  fields,
  keyField,
  sourceDomain,
  onSelectReceipt,
}) => {
  // Determine entity title (primary keyField value or first non-empty string value)
  let entityTitle = "";
  if (keyField && record.values[keyField]) {
    entityTitle = String(record.values[keyField]);
  } else {
    for (const f of fields) {
      if (record.values[f.key]) {
        entityTitle = String(record.values[f.key]);
        break;
      }
    }
  }
  if (!entityTitle) {
    entityTitle = "Unnamed Entity";
  }

  const isMerged = (record.mergedFrom?.length || 0) > 0;
  const isFlagged = (record.flags?.length || 0) > 0;
  const rowConfidencePct = Math.round((record.rowConfidence || 0) * 100);

  return (
    <article
      aria-label={`Specimen record: ${entityTitle}`}
      className="bg-paper-2/60 border border-rule rounded-xs p-4 space-y-3.5 hover:border-signal/40 transition-colors"
    >
      {/* Top Header: Entity Title & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="font-display text-lg text-ink font-medium leading-snug truncate">
            {entityTitle}
          </h3>
          {sourceDomain && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-paper border border-rule rounded-xs font-mono text-[10px] text-ink-soft">
              <IconSource className="w-3 h-3 text-ink-soft shrink-0" />
              <span className="truncate">{sourceDomain}</span>
            </div>
          )}
        </div>

        {/* Metadata Badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant={
              isFlagged ? "reject" : rowConfidencePct >= 80 ? "verified" : "caution"
            }
          >
            {rowConfidencePct}%
          </Badge>
          {isMerged && (
            <Badge variant="neutral">
              Merged
            </Badge>
          )}
          {isFlagged && (
            <Badge variant="caution">
              Flagged
            </Badge>
          )}
        </div>
      </div>

      {/* Field ledger key-value pairs */}
      <div className="border-t border-rule/60 pt-2.5 grid grid-cols-1 gap-2">
        {fields.map((field) => {
          const val = record.values[field.key];
          const displayVal =
            val !== undefined && val !== null && String(val).trim() !== ""
              ? String(val)
              : "Not reported";

          const receipt = record.receipts?.[field.key];
          const validatorStatus = receipt?.validator?.status;

          return (
            <div
              key={field.key}
              className="flex items-center justify-between gap-2 py-1"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft shrink-0">
                {field.label}
              </span>

              {/* Cell Value Button - tap opens receipt */}
              <button
                type="button"
                data-receipt-trigger="true"
                onClick={() => onSelectReceipt(record, field.key)}
                aria-label={`View receipt for ${field.key}: ${displayVal}`}
                className="group flex items-center gap-1.5 px-2 py-1 rounded-xs bg-paper/60 hover:bg-ink/5 border border-rule/50 hover:border-signal text-left font-mono text-xs text-ink transition-colors cursor-pointer max-w-[65%] min-h-[36px]"
              >
                <span className="truncate group-hover:text-signal transition-colors font-medium">
                  {displayVal}
                </span>

                {/* Verification Mark */}
                {validatorStatus === "verified" ? (
                  <IconCheck
                    className="w-3.5 h-3.5 text-cairn-verified shrink-0"
                    aria-hidden="true"
                  />
                ) : validatorStatus === "contradicted" ? (
                  <IconFlag
                    className="w-3.5 h-3.5 text-cairn-reject shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-cairn-caution shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
};
