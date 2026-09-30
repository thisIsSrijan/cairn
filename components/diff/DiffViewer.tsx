"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { RunDiffResult, ChangedRecord } from "@/lib/pipeline/diff";
import type { RecordDoc } from "@/lib/db/schemas";
import { IconDiff } from "@/components/icons/IconDiff";
import { IconPlus } from "@/components/icons/IconPlus";
import { IconCross } from "@/components/icons/IconCross";
import { IconChevron } from "@/components/icons/IconChevron";
import { Button } from "@/components/ui/Button";

export interface DiffViewerProps {
  diff: RunDiffResult;
  fields: { key: string; label: string }[];
  workflowId: string;
  runId: string;
  onSelectReceipt: (record: RecordDoc & { id: string }, fieldKey: string) => void;
}

function getEntityTitle(
  record: RecordDoc & { id: string }
): string {
  const shortId = record.id ? record.id.slice(-6) : (record.fingerprint?.slice(0, 6) || "unknown");
  return `Record #${shortId}`;
}

function ValueCell({
  value,
  variant,
}: {
  value: unknown;
  variant: "added" | "removed" | "before" | "after";
}) {
  const styleMap = {
    added: "text-verified font-medium",
    removed: "text-reject font-medium line-through",
    before: "text-ink-soft line-through",
    after: "text-ink font-semibold",
  };
  return (
    <span
      className={`font-mono text-xs tabular-nums ${styleMap[variant]} break-words`}
    >
      {value === null || value === undefined ? (
        <span className="text-ink-soft italic">null</span>
      ) : (
        String(value)
      )}
    </span>
  );
}

function RecordRow({
  record,
  fields,
  variant,
  onSelectReceipt,
}: {
  record: RecordDoc & { id: string };
  fields: { key: string; label: string }[];
  variant: "added" | "removed";
  onSelectReceipt: (record: RecordDoc & { id: string }, fieldKey: string) => void;
}) {
  const reduce = useReducedMotion();
  const borderColor = variant === "added" ? "border-verified/40" : "border-reject/40";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`border ${borderColor} bg-paper rounded-xs p-3 space-y-2`}
    >
      <div className="flex items-center gap-2">
        {variant === "added" ? (
          <IconPlus className="w-3.5 h-3.5 text-verified shrink-0" />
        ) : (
          <IconCross className="w-3.5 h-3.5 text-reject shrink-0" />
        )}
        <span className="font-display text-sm text-ink font-medium truncate">
          {getEntityTitle(record)}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {fields.map((f) => {
          const val = record.values[f.key];
          if (val === undefined || val === null) return null;
          return (
            <div key={f.key} className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {f.label}
              </span>
              <button
                type="button"
                data-receipt-trigger="true"
                className="text-left"
                onClick={() => onSelectReceipt(record, f.key)}
                aria-label={`Inspect receipt for ${f.label}`}
              >
                <ValueCell value={val} variant={variant} />
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ChangedRow({
  changed,
  fields,
  workflowId,
  runId,
  onSelectReceipt,
}: {
  changed: ChangedRecord;
  fields: { key: string; label: string }[];
  workflowId: string;
  runId: string;
  onSelectReceipt: (record: RecordDoc & { id: string }, fieldKey: string) => void;
}) {
  const reduce = useReducedMotion();
  const changedKeys = Object.keys(changed.changes);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="border border-caution/40 bg-paper rounded-xs p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconDiff className="w-3.5 h-3.5 text-caution shrink-0" />
          <span className="font-display text-sm text-ink font-medium truncate">
            {getEntityTitle(changed.current)}
          </span>
        </div>
        <Link
          href={`/w/${workflowId}/runs/${runId}/results`}
          className="font-mono text-[10px] text-ink-soft hover:text-signal transition-colors shrink-0 flex items-center gap-1"
        >
          View record
          <IconChevron direction="right" className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {changedKeys.map((key) => {
          const fieldDef = fields.find((f) => f.key === key);
          const label = fieldDef?.label || key;
          const change = changed.changes[key];
          return (
            <div
              key={key}
              className="grid grid-cols-[auto_1fr_1fr] gap-2 items-start border-t border-rule/50 pt-2 first:border-t-0 first:pt-0"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft w-24 shrink-0 pt-0.5">
                {label}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-ink-soft tracking-wider">
                  Before
                </span>
                <ValueCell value={change.previous} variant="before" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] uppercase text-ink font-medium tracking-wider">
                  After
                </span>
                <button
                  type="button"
                  data-receipt-trigger="true"
                  className="text-left"
                  onClick={() => onSelectReceipt(changed.current, key)}
                  aria-label={`Inspect receipt for ${label}`}
                >
                  <ValueCell value={change.current} variant="after" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SectionHeader({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: "verified" | "reject" | "caution";
  icon: React.ReactNode;
}) {
  const borderMap = {
    verified: "border-verified/40",
    reject: "border-reject/40",
    caution: "border-caution/40",
  };
  return (
    <div
      className={`flex items-center gap-2 border-b ${borderMap[color]} pb-2 mb-3`}
    >
      {icon}
      <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-ink-soft ml-auto">
        {count}
      </span>
    </div>
  );
}

// Inline contour SVG illustration for empty / no-change states
function NoChangeIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-24 h-16 text-ink-soft"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="60" cy="72" rx="44" ry="5" stroke="var(--color-rule)" strokeWidth="1" />
      <path
        d="M20 65 Q60 60 100 65"
        stroke="var(--color-rule)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M30 55 Q60 50 90 55"
        stroke="var(--color-rule)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <path
        d="M40 45 Q60 41 80 45"
        stroke="var(--color-rule)"
        strokeWidth="1"
        strokeDasharray="2 5"
      />
      <rect
        x="42"
        y="28"
        width="36"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <rect
        x="47"
        y="16"
        width="26"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <circle
        cx="60"
        cy="8"
        r="5"
        stroke="var(--color-rule)"
        strokeWidth="1.25"
        fill="var(--color-paper-2)"
      />
      <path
        d="M55 8h10M60 3v10"
        stroke="var(--color-ink-soft)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FirstRunIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-24 h-16 text-ink-soft"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="60" cy="72" rx="44" ry="5" stroke="var(--color-rule)" strokeWidth="1" />
      <path
        d="M20 65 Q60 60 100 65"
        stroke="var(--color-rule)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect
        x="35"
        y="50"
        width="50"
        height="14"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <rect
        x="42"
        y="36"
        width="36"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <rect
        x="47"
        y="24"
        width="26"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <circle
        cx="60"
        cy="14"
        r="7"
        fill="var(--color-signal)"
        stroke="var(--color-signal)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function DiffViewer({
  diff,
  fields,
  workflowId,
  runId,
  onSelectReceipt,
}: DiffViewerProps) {
  const hasNoPrevious = !diff.previousRunId;
  const hasNoChanges =
    diff.summary.added === 0 &&
    diff.summary.removed === 0 &&
    diff.summary.changed === 0;

  // Summary counts formatted
  const summaryParts = [
    diff.summary.added > 0 ? `+${diff.summary.added}` : null,
    diff.summary.removed > 0 ? `-${diff.summary.removed}` : null,
    diff.summary.changed > 0 ? `~${diff.summary.changed}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6 pb-20">
      {/* Summary Rule */}
      <div
        data-testid="diff-summary"
        className="flex flex-wrap items-center gap-3 py-3 border-y border-rule font-mono text-sm"
        role="status"
        aria-label="Diff summary"
      >
        <IconDiff className="w-4 h-4 text-ink-soft shrink-0" />
        <span className="text-ink-soft text-xs uppercase tracking-wider">Changes since last run:</span>
        {summaryParts.length > 0 ? (
          <div className="flex items-center gap-2">
            {diff.summary.added > 0 && (
              <span className="text-verified font-semibold tabular-nums">
                +{diff.summary.added}
              </span>
            )}
            {diff.summary.removed > 0 && (
              <span className="text-reject font-semibold tabular-nums">
                -{diff.summary.removed}
              </span>
            )}
            {diff.summary.changed > 0 && (
              <span className="text-caution font-semibold tabular-nums">
                ~{diff.summary.changed}
              </span>
            )}
          </div>
        ) : (
          <span className="text-ink-soft text-xs tabular-nums">0 changes</span>
        )}
        {diff.previousRunId && (
          <span className="text-[11px] text-ink-soft ml-auto">
            vs run <span className="tabular-nums">{diff.previousRunId.slice(-6)}</span>
          </span>
        )}
      </div>

      {/* First Run State */}
      {hasNoPrevious && (
        <div className="py-12 px-4 text-center space-y-4 bg-paper-2/40 border border-rule border-dashed rounded-xs max-w-md mx-auto">
          <div className="flex justify-center">
            <FirstRunIllustration />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-lg text-ink font-medium">First run baseline</h3>
            <p className="font-mono text-xs text-ink-soft leading-relaxed">
              This is the initial baseline for this workflow. Run the collection again to compare changes between runs.
            </p>
          </div>
          <div>
            <Link href={`/w/${workflowId}/runs/${runId}/results`}>
              <Button variant="secondary" size="sm">
                View results
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* No-Changes Empty State */}
      {!hasNoPrevious && hasNoChanges && (
        <div className="py-12 px-4 text-center space-y-4 bg-paper-2/40 border border-rule border-dashed rounded-xs max-w-md mx-auto">
          <div className="flex justify-center">
            <NoChangeIllustration />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-lg text-ink font-medium">No changes detected</h3>
            <p className="font-mono text-xs text-ink-soft leading-relaxed">
              The verified dataset is identical to the previous run. All records match fingerprint and field values.
            </p>
          </div>
        </div>
      )}

      {/* Added Section */}
      {!hasNoPrevious && diff.added.length > 0 && (
        <section aria-label="Added records">
          <SectionHeader
            label="Added"
            count={diff.added.length}
            color="verified"
            icon={<IconPlus className="w-4 h-4 text-verified" />}
          />
          <div className="space-y-2">
            {diff.added.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                fields={fields}
                variant="added"
                onSelectReceipt={onSelectReceipt}
              />
            ))}
          </div>
        </section>
      )}

      {/* Removed Section */}
      {!hasNoPrevious && diff.removed.length > 0 && (
        <section aria-label="Removed records">
          <SectionHeader
            label="Removed"
            count={diff.removed.length}
            color="reject"
            icon={<IconCross className="w-4 h-4 text-reject" />}
          />
          <div className="space-y-2">
            {diff.removed.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                fields={fields}
                variant="removed"
                onSelectReceipt={onSelectReceipt}
              />
            ))}
          </div>
        </section>
      )}

      {/* Changed Section */}
      {!hasNoPrevious && diff.changed.length > 0 && (
        <section aria-label="Changed records">
          <SectionHeader
            label="Changed"
            count={diff.changed.length}
            color="caution"
            icon={<IconDiff className="w-4 h-4 text-caution" />}
          />
          <div className="space-y-2">
            {diff.changed.map((changed, idx) => (
              <ChangedRow
                key={changed.current.id || idx}
                changed={changed}
                fields={fields}
                workflowId={workflowId}
                runId={runId}
                onSelectReceipt={onSelectReceipt}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
