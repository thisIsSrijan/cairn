"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Workflow, Run } from "@/lib/db/schemas";
import { Badge } from "@/components/ui/Badge";
import { IconChevron } from "@/components/icons/IconChevron";
import { IconDiff } from "@/components/icons/IconDiff";

interface WorkflowWithRun extends Workflow {
  id: string;
  _id?: string;
  latestRun?: Run & { id: string };
  exportCount?: number;
}

// Contour-language empty state illustration
function EmptyIllustration() {
  return (
    <svg
      viewBox="0 0 140 90"
      className="w-28 h-18 text-ink-soft"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="70" cy="82" rx="55" ry="6" stroke="var(--color-rule)" strokeWidth="1" />
      <path
        d="M15 74 Q70 68 125 74"
        stroke="var(--color-rule)"
        strokeWidth="1.5"
        strokeDasharray="5 3"
      />
      <path
        d="M25 64 Q70 58 115 64"
        stroke="var(--color-rule)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <path
        d="M35 54 Q70 49 105 54"
        stroke="var(--color-rule)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <path
        d="M45 44 Q70 40 95 44"
        stroke="var(--color-rule)"
        strokeWidth="0.75"
        strokeDasharray="2 6"
      />
      {/* Cairn stone stack */}
      <rect
        x="40"
        y="30"
        width="60"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <rect
        x="48"
        y="16"
        width="44"
        height="13"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
      <rect
        x="54"
        y="5"
        width="32"
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
      />
    </svg>
  );
}

function VerifiedBar({ verified, total }: { verified: number; total: number }) {
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1 flex-1 bg-rule/60 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% verified`}
      >
        <div
          className="h-full bg-verified rounded-full transition-all duration-normal"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-ink-soft w-8 shrink-0">
        {pct}%
      </span>
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const DatasetsLedger: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowWithRun[]>([]);
  const [loading, setLoading] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch("/api/workflows");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setWorkflows(data.items || []);
        }
      } catch (err) {
        console.error("Failed to load workflows:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const completedWorkflows = workflows.filter((w) => Boolean(w.latestRunId));

  if (loading) {
    return (
      <div
        className="py-16 text-center space-y-3 bg-paper-2/40 border border-rule border-dashed rounded-xs font-mono text-xs text-ink-soft"
        aria-live="polite"
      >
        <div className="w-5 h-5 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading verified datasets...</p>
      </div>
    );
  }

  if (completedWorkflows.length === 0) {
    return (
      <div className="py-12 px-6 border border-rule border-dashed rounded-xs text-center space-y-5 bg-paper-2/40 max-w-lg mx-auto">
        <div className="flex justify-center">
          <EmptyIllustration />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-lg text-ink font-medium">
            No datasets collected yet
          </h2>
          <p className="font-mono text-xs text-ink-soft leading-relaxed max-w-sm mx-auto">
            Every collected value carries a verifiable receipt: source URL, verbatim evidence quote, and validator verdict. Start your first collection to build the ledger.
          </p>
        </div>
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs border border-ink rounded-xs px-4 py-2 text-ink hover:bg-ink/5 transition-colors"
          >
            Plan your first dataset
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Column headers - desktop only */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 pb-2 border-b border-rule text-[10px] font-mono uppercase tracking-wider text-ink-soft">
        <span>Workflow</span>
        <span className="text-right w-20">Date</span>
        <span className="text-right w-16">Records</span>
        <span className="w-28">Verified</span>
        <span className="text-right w-14">Exports</span>
        <span className="w-20"></span>
      </div>

      <div className="border border-rule rounded-xs bg-paper divide-y divide-rule">
        {completedWorkflows.map((wf, idx) => {
          const wfId = wf.id || (wf as unknown as { _id: string })._id || "";
          const resultsUrl = `/w/${wfId}/runs/${wf.latestRunId}/results`;
          const workflowUrl = `/w/${wfId}`;

          // Pull run data if available
          const latestRun = wf.latestRun;
          const recordsKept = latestRun?.counts?.recordsKept ?? 0;
          const verified = latestRun?.counts?.verified ?? 0;
          const finishedAt = latestRun?.finishedAt ?? wf.updatedAt;
          const hasDiff = Boolean(latestRun?.previousRunId);
          const exportCount = wf.exportCount ?? 0;

          return (
            <motion.div
              key={wfId}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.22,
                delay: idx * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group"
            >
              {/* Mobile: stacked card layout */}
              <div className="md:hidden p-4 space-y-3 hover:bg-ink/5 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={wf.status === "completed" ? "verified" : "neutral"}
                      >
                        {wf.status}
                      </Badge>
                      {wf.blueprint?.entity && (
                        <span className="font-mono text-[10px] text-ink-soft">
                          {wf.blueprint.entity}
                        </span>
                      )}
                    </div>
                    <Link
                      href={workflowUrl}
                      className="block font-display text-base text-ink group-hover:text-signal transition-colors font-medium leading-snug"
                    >
                      {wf.title || wf.prompt}
                    </Link>
                    <span className="font-mono text-[11px] text-ink-soft">
                      {formatDate(finishedAt)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-xs text-ink-soft">
                    <span>
                      <span className="text-ink tabular-nums font-semibold">
                        {recordsKept}
                      </span>{" "}
                      records kept
                    </span>
                    <span className="text-[10px] text-ink-soft">
                      {exportCount} {exportCount === 1 ? "export" : "exports"}
                    </span>
                  </div>
                  <VerifiedBar verified={verified} total={recordsKept} />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={resultsUrl}
                    className="inline-flex items-center gap-1 font-mono text-xs text-ink-soft hover:text-signal transition-colors border border-rule rounded-xs px-3 py-1.5 bg-paper hover:bg-paper-2"
                  >
                    Open Results
                    <IconChevron direction="right" className="w-3 h-3" />
                  </Link>
                  {hasDiff && latestRun && (
                    <Link
                      href={`/w/${wfId}/runs/${wf.latestRunId}/diff`}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-caution hover:text-signal transition-colors"
                    >
                      <IconDiff className="w-3 h-3" />
                      Changes
                    </Link>
                  )}
                </div>
              </div>

              {/* Desktop: table row layout */}
              <div className="hidden md:grid md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-4 hover:bg-ink/5 transition-colors">
                {/* Workflow info */}
                <div className="min-w-0 space-y-0.5">
                  <Link
                    href={workflowUrl}
                    className="block font-display text-sm text-ink group-hover:text-signal transition-colors font-medium truncate"
                  >
                    {wf.title || wf.prompt}
                  </Link>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-ink-soft">
                    {wf.blueprint?.entity && <span>{wf.blueprint.entity}</span>}
                    <span className="text-rule">|</span>
                    <span>{wf.blueprint?.fields?.length || 0} fields</span>
                    {hasDiff && latestRun && (
                      <>
                        <span className="text-rule">|</span>
                        <Link
                          href={`/w/${wfId}/runs/${wf.latestRunId}/diff`}
                          className="inline-flex items-center gap-0.5 text-caution hover:text-signal transition-colors"
                        >
                          <IconDiff className="w-3 h-3" />
                          Changes
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Date */}
                <span className="font-mono text-xs text-ink-soft tabular-nums text-right w-20">
                  {formatDate(finishedAt)}
                </span>

                {/* Records kept */}
                <span className="font-mono text-xs tabular-nums text-right w-16">
                  <span className="text-ink font-semibold">{recordsKept}</span>
                  <span className="text-ink-soft text-[10px] ml-1">kept</span>
                </span>

                {/* Verified share bar */}
                <div className="w-28">
                  <VerifiedBar verified={verified} total={recordsKept} />
                </div>

                {/* Export count */}
                <span className="font-mono text-xs text-ink-soft tabular-nums text-right w-14">
                  <span className="text-ink">{exportCount}</span>
                </span>

                {/* Actions */}
                <div className="w-20 flex justify-end">
                  <Link
                    href={resultsUrl}
                    className="inline-flex items-center gap-1 font-mono text-xs text-ink-soft hover:text-signal transition-colors border border-rule rounded-xs px-3 py-1.5 bg-paper hover:bg-paper-2"
                  >
                    Open
                    <IconChevron direction="right" className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
