"use client";

import React from "react";
import type { RecordDoc } from "@/lib/db/schemas";
import { IconCheck } from "@/components/icons/IconCheck";
import { IconFlag } from "@/components/icons/IconFlag";
import { IconChevron } from "@/components/icons/IconChevron";
import { Badge } from "@/components/ui/Badge";

export interface RecordsTableProps {
  records: (RecordDoc & { id: string })[];
  fields: Array<{ key: string; label: string }>;
  sourceDomains: Record<string, string>;
  sort?: string;
  onSortChange: (sort: string) => void;
  onSelectReceipt: (record: RecordDoc & { id: string }, field: string) => void;
}

export const RecordsTable: React.FC<RecordsTableProps> = ({
  records,
  fields,
  sourceDomains,
  sort,
  onSortChange,
  onSelectReceipt,
}) => {
  const toggleSort = (sortKey: string) => {
    if (sort === `${sortKey}_desc`) {
      onSortChange(`${sortKey}_asc`);
    } else {
      onSortChange(`${sortKey}_desc`);
    }
  };

  return (
    <div className="overflow-x-auto border border-rule rounded-xs bg-paper">
      <table className="w-full border-collapse text-left font-mono text-xs">
        <thead className="sticky top-0 bg-paper-2 border-b border-rule z-10">
          <tr>
            <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-ink-soft font-semibold w-12 text-center">
              #
            </th>

            {fields.map((field) => (
              <th
                key={field.key}
                className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-ink-soft font-semibold whitespace-nowrap"
              >
                {field.label}
              </th>
            ))}

            <th
              className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-ink-soft font-semibold whitespace-nowrap cursor-pointer hover:text-ink select-none"
              onClick={() => toggleSort("confidence")}
            >
              <div className="flex items-center gap-1">
                <span>Confidence</span>
                <IconChevron
                  direction={sort === "confidence_asc" ? "up" : "down"}
                  className="w-3 h-3 text-ink-soft"
                />
              </div>
            </th>

            <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-ink-soft font-semibold whitespace-nowrap">
              Provenance
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-rule/60">
          {records.map((record, idx) => {
            const rowConfidencePct = Math.round((record.rowConfidence || 0) * 100);
            const isMerged = (record.mergedFrom?.length || 0) > 0;
            const isFlagged = (record.flags?.length || 0) > 0;

            // Get first source domain from receipts
            let domain = "";
            for (const r of Object.values(record.receipts || {})) {
              if (r.sourceId && sourceDomains[r.sourceId]) {
                domain = sourceDomains[r.sourceId];
                break;
              }
            }

            return (
              <tr
                key={record.id}
                className="hover:bg-ink/5 transition-colors group"
              >
                {/* Row Number */}
                <td className="py-2.5 px-3 text-ink-soft text-center tabular-nums text-[11px]">
                  {idx + 1}
                </td>

                {/* Field Columns */}
                {fields.map((field) => {
                  const val = record.values[field.key];
                  const displayVal =
                    val !== undefined && val !== null && String(val).trim() !== ""
                      ? String(val)
                      : "Not reported";

                  const receipt = record.receipts?.[field.key];
                  const validatorStatus = receipt?.validator?.status;

                  return (
                    <td key={field.key} className="py-2 px-2.5 max-w-xs truncate">
                      <button
                        type="button"
                        data-receipt-trigger="true"
                        onClick={() => onSelectReceipt(record, field.key)}
                        aria-label={`View receipt for ${field.key}: ${displayVal}`}
                        className="w-full text-left flex items-center justify-between gap-1.5 px-2 py-1 rounded-xs hover:bg-ink/5 border border-transparent hover:border-signal/40 text-ink transition-colors cursor-pointer group/cell"
                      >
                        <span className="truncate group-hover/cell:text-signal transition-colors font-medium">
                          {displayVal}
                        </span>

                        {/* Per-cell verification mark */}
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
                    </td>
                  );
                })}

                {/* Confidence Badge */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        isFlagged
                          ? "reject"
                          : rowConfidencePct >= 80
                          ? "verified"
                          : "caution"
                      }
                    >
                      {rowConfidencePct}%
                    </Badge>
                    {isMerged && <Badge variant="neutral">Merged</Badge>}
                    {isFlagged && <Badge variant="caution">Flagged</Badge>}
                  </div>
                </td>

                {/* Provenance Domain */}
                <td className="py-2.5 px-3 text-ink-soft whitespace-nowrap text-[11px] truncate max-w-[180px]">
                  {domain || "Primary Source"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
