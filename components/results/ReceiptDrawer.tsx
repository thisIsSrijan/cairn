"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { RecordDoc, Receipt } from "@/lib/db/schemas";
import { IconClose } from "@/components/icons/IconClose";
import { IconLink } from "@/components/icons/IconLink";
import { IconSource } from "@/components/icons/IconSource";
import { IconClock } from "@/components/icons/IconClock";
import { Badge } from "@/components/ui/Badge";
import { easings, durations } from "@/lib/motion";

export interface ReceiptDetailData {
  receipt: Receipt;
  location?: { start: number; end: number } | null;
  window?: {
    prefix: string;
    match: string;
    suffix: string;
    text: string;
  } | null;
  source: {
    id: string;
    url: string;
    domain: string;
    title?: string | null;
    fetchedAt?: Date | string | null;
  };
}

export interface ReceiptDrawerProps {
  open: boolean;
  onClose: () => void;
  record: (RecordDoc & { id: string }) | null;
  field: string | null;
  receiptDetail: ReceiptDetailData | null;
  loading: boolean;
}

export const ReceiptDrawer: React.FC<ReceiptDrawerProps> = ({
  open,
  onClose,
  record,
  field,
  receiptDetail,
  loading,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus close button on open
  useEffect(() => {
    if (open && drawerRef.current) {
      const closeBtn = drawerRef.current.querySelector<HTMLButtonElement>(
        'button[aria-label="Close receipt"]'
      );
      closeBtn?.focus();
    }
  }, [open]);

  if (!open || !record || !field) return null;

  const fieldValue = record.values[field];
  const displayValue =
    fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : "Not reported";

  const primaryReceipt = receiptDetail?.receipt || record.receipts?.[field];
  const validatorStatus = primaryReceipt?.validator?.status || "unverified";
  const confidence = primaryReceipt?.confidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  // Look for corroborating receipts
  const corroboratingReceipts: Array<{ key: string; receipt: Receipt }> = [];
  const conflictingReceipts: Array<{ key: string; receipt: Receipt }> = [];

  for (const [rKey, rVal] of Object.entries(record.receipts || {})) {
    if (rKey.startsWith(`${field}__corroborated_`)) {
      corroboratingReceipts.push({ key: rKey, receipt: rVal });
    } else if (rKey.startsWith(`${field}__conflict_`)) {
      conflictingReceipts.push({ key: rKey, receipt: rVal });
    }
  }

  const isMerged = (record.mergedFrom?.length || 0) > 0 || corroboratingReceipts.length > 0;
  const isContradicted =
    validatorStatus === "contradicted" ||
    conflictingReceipts.length > 0 ||
    record.flags?.some((f) => f.includes(field));

  const formatDate = (dateInput?: Date | string | null) => {
    if (!dateInput) return "Unknown";
    const d = new Date(dateInput);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  };

  return (
    <AnimatePresence>
      <div
        data-testid="receipt-drawer"
        className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : durations.fast,
            ease: easings.ledger,
          }}
          onClick={onClose}
          className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
          aria-hidden="true"
        />

        {/* Responsive Panel: Bottom sheet on mobile, right side panel on desktop */}
        <motion.div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt for ${field}: ${displayValue}`}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : typeof window !== "undefined" && window.innerWidth >= 768
              ? { x: "100%" }
              : { y: "100%" }
          }
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : typeof window !== "undefined" && window.innerWidth >= 768
              ? { x: "100%" }
              : { y: "100%" }
          }
          transition={{
            duration: shouldReduceMotion ? 0 : durations.normal,
            ease: easings.ledger,
          }}
          className="relative z-10 w-full md:max-w-lg lg:max-w-xl max-h-[90dvh] md:max-h-none md:h-full overflow-y-auto bg-paper border-t md:border-t-0 md:border-l border-rule rounded-t-[10px] md:rounded-none shadow-2xl p-5 md:p-6 pb-10 space-y-6"
        >
          {/* Mobile Drag Indicator */}
          <div className="md:hidden flex justify-center pb-2">
            <div className="h-1 w-10 rounded-full bg-rule" aria-hidden="true" />
          </div>

          {/* Drawer Header */}
          <div className="flex items-start justify-between gap-4 border-b border-rule pb-4">
            <div className="space-y-1 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft block font-semibold">
                Field Receipt Provenance
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-xs bg-ink/5 border border-rule text-ink font-semibold">
                  {field}
                </span>
                <Badge
                  variant={
                    validatorStatus === "verified"
                      ? "verified"
                      : validatorStatus === "contradicted"
                      ? "reject"
                      : "caution"
                  }
                >
                  {validatorStatus}
                </Badge>
              </div>
              <h2 className="font-display text-xl sm:text-2xl text-ink font-medium leading-snug break-words pt-1">
                {displayValue}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xs text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal shrink-0"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {/* Verification Verdict & Notes */}
          <div className="space-y-2 bg-paper-2/60 border border-rule rounded-xs p-3.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-ink-soft">
                Validator Verdict
              </span>
              <span className="font-semibold text-ink uppercase tracking-wide">
                {validatorStatus}
              </span>
            </div>
            {primaryReceipt?.validator?.notes && (
              <p className="text-ink-soft text-[11px] leading-relaxed border-t border-rule/50 pt-2">
                Note: {primaryReceipt.validator.notes}
              </p>
            )}
          </div>

          {/* Confidence Meter Rule */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-[11px] uppercase tracking-wider text-ink-soft">
                Confidence Score
              </span>
              <span className="text-ink font-semibold tabular-nums">
                {confidencePct}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Extraction confidence"
              className="h-2 w-full bg-rule/40 rounded-full overflow-hidden"
            >
              <div
                style={{ width: `${confidencePct}%` }}
                className={`h-full transition-all duration-medium ${
                  validatorStatus === "verified"
                    ? "bg-cairn-verified"
                    : validatorStatus === "contradicted"
                    ? "bg-cairn-reject"
                    : "bg-cairn-caution"
                }`}
              />
            </div>
          </div>

          {/* Provenance Source URL & Timestamp */}
          <div className="space-y-3 bg-paper-2/40 border border-rule rounded-xs p-3.5 font-mono text-xs">
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Permitted Web Source
            </span>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-ink">
                <IconSource className="w-3.5 h-3.5 text-ink-soft shrink-0" />
                <span className="font-semibold truncate">
                  {receiptDetail?.source?.domain || "Source Document"}
                </span>
              </div>

              {receiptDetail?.source?.url && (
                <div className="pt-1">
                  <a
                    href={receiptDetail.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open source link in new tab"
                    className="inline-flex items-center gap-1.5 text-signal hover:underline break-all text-[11px]"
                  >
                    <span>{receiptDetail.source.url}</span>
                    <IconLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-ink-soft text-[11px] pt-1">
                <IconClock className="w-3 h-3 shrink-0" />
                <span>
                  Fetched: {formatDate(receiptDetail?.source?.fetchedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Snapshot Window */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft font-semibold">
                Evidence Snapshot
              </span>
              <span className="font-mono text-[10px] text-ink-soft">
                Verbatim In Snapshot
              </span>
            </div>

            {loading ? (
              <div className="p-6 bg-paper-2 border border-rule border-dashed rounded-xs text-center font-mono text-xs text-ink-soft animate-pulse">
                Locating evidence quote in stored page snapshot...
              </div>
            ) : receiptDetail?.window ? (
              <div className="bg-paper-2 border border-rule rounded-xs p-3.5 font-mono text-xs text-ink/90 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-56">
                <span>{receiptDetail.window.prefix}</span>
                {/* Evidence quote inside mark element styled with signal underline, strictly no yellow highlight */}
                <mark className="bg-transparent text-inherit font-semibold border-b-2 border-signal px-0.5">
                  {receiptDetail.window.match}
                </mark>
                <span>{receiptDetail.window.suffix}</span>
              </div>
            ) : primaryReceipt?.evidence ? (
              <div className="bg-paper-2 border border-rule rounded-xs p-3.5 font-mono text-xs text-ink/90 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-56">
                <mark className="bg-transparent text-inherit font-semibold border-b-2 border-signal px-0.5">
                  {primaryReceipt.evidence}
                </mark>
              </div>
            ) : (
              <div className="p-4 bg-paper-2 border border-rule rounded-xs text-ink-soft font-mono text-xs">
                No verbatim evidence quote recorded for this field.
              </div>
            )}
          </div>

          {/* Numbered Trail Motif for Merged Receipts */}
          {isMerged && (
            <div className="space-y-3 border-t border-rule pt-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink block font-semibold">
                Corroboration Trail
              </span>
              <p className="font-mono text-xs text-ink-soft leading-relaxed">
                This record was corroborated across multiple independent permitted sources.
              </p>

              <div className="space-y-0 relative pl-2">
                {/* Trail step 1 */}
                <div className="flex items-start gap-3 relative pb-4">
                  {/* Connecting line */}
                  <div className="absolute left-3.5 top-6 bottom-0 w-0.5 bg-rule" />

                  <span className="w-7 h-7 rounded-full bg-paper-2 border border-rule flex items-center justify-center font-mono text-xs font-bold text-ink shrink-0 z-10">
                    01
                  </span>
                  <div className="space-y-1 font-mono text-xs min-w-0 flex-1">
                    <span className="text-[11px] text-ink-soft font-medium block">
                      Primary Source: {receiptDetail?.source?.domain || "Source 1"}
                    </span>
                    <p className="text-ink text-[11px] bg-paper-2/60 p-2 rounded-xs border border-rule/50 italic">
                      &quot;{primaryReceipt?.evidence || displayValue}&quot;
                    </p>
                  </div>
                </div>

                {/* Trail step 2 */}
                <div className="flex items-start gap-3 relative">
                  <span className="w-7 h-7 rounded-full bg-paper-2 border border-rule flex items-center justify-center font-mono text-xs font-bold text-ink shrink-0 z-10">
                    02
                  </span>
                  <div className="space-y-1 font-mono text-xs min-w-0 flex-1">
                    <span className="text-[11px] text-ink-soft font-medium block">
                      Corroborating Evidence
                    </span>
                    <p className="text-ink text-[11px] bg-paper-2/60 p-2 rounded-xs border border-rule/50 italic">
                      {corroboratingReceipts[0]?.receipt?.evidence ||
                        "Corroborating record confirmed in secondary crawl."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contradiction Side-by-Side Comparison */}
          {isContradicted && (
            <div className="space-y-3 border-t border-cairn-reject/40 pt-4 bg-cairn-reject/5 p-3.5 rounded-xs">
              <span className="font-mono text-[11px] uppercase tracking-wider text-cairn-reject block font-semibold">
                Contradiction Flagged
              </span>
              <p className="font-mono text-xs text-ink-soft leading-relaxed">
                Conflicting evidence was detected between crawl sources. Code flagged the discrepancy for surveyor inspection.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-xs">
                {/* Value A */}
                <div className="p-3 bg-paper border border-rule rounded-xs space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-ink-soft block font-semibold">
                    Primary Extracted Value
                  </span>
                  <span className="text-sm font-semibold text-ink block">
                    {displayValue}
                  </span>
                  <p className="text-[11px] text-ink-soft italic border-t border-rule/50 pt-1">
                    {primaryReceipt?.evidence}
                  </p>
                </div>

                {/* Value B */}
                <div className="p-3 bg-paper border border-cairn-reject/40 rounded-xs space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-cairn-reject block font-semibold">
                    Conflicting Value
                  </span>
                  <span className="text-sm font-semibold text-ink block">
                    {conflictingReceipts[0]?.receipt?.validator?.notes || "Conflicting data point"}
                  </span>
                  <p className="text-[11px] text-ink-soft italic border-t border-rule/50 pt-1">
                    {conflictingReceipts[0]?.receipt?.evidence || "Secondary source claims different specification."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
