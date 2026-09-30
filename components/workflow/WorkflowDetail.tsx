"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Workflow, Run } from "@/lib/db/schemas";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconPlay } from "@/components/icons/IconPlay";
import { IconDiff } from "@/components/icons/IconDiff";
import { IconChevron } from "@/components/icons/IconChevron";
import { IconClock } from "@/components/icons/IconClock";

export interface WorkflowDetailProps {
  workflow: Workflow & { id: string };
  runs: (Run & { id: string })[];
  onRunAgain: () => void;
  runningId: string | null;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: Date | string | null, end: Date | string | null): string {
  if (!start || !end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

// Small stone SVG marker for the trail
function StoneMarker({ isLatest }: { isLatest: boolean }) {
  if (isLatest) {
    return (
      <div
        data-testid="run-trail-marker-latest"
        aria-hidden="true"
        className="relative flex-none"
      >
        {/* Pulsing ring for latest */}
        <div className="absolute inset-0 rounded-full border-2 border-signal animate-ping opacity-20" />
        <div className="w-4 h-4 rounded-full bg-signal border-2 border-signal shadow-sm relative z-10" />
      </div>
    );
  }
  return (
    <div
      data-testid="run-trail-marker"
      aria-hidden="true"
      className="flex-none w-4 h-4 rounded-full bg-paper border-2 border-ink-soft"
    />
  );
}

// Blueprint field pill
function FieldPill({ label, required }: { label: string; required: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-xs border font-mono text-[10px] uppercase tracking-wide ${
        required
          ? "border-ink/30 text-ink bg-paper-2"
          : "border-rule text-ink-soft bg-transparent"
      }`}
    >
      {label}
      {required && (
        <span className="text-signal text-[8px] font-bold ml-0.5" aria-label="required">
          *
        </span>
      )}
    </span>
  );
}

// Contour empty state illustration
function EmptyRunIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="w-20 h-14 text-ink-soft"
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
      <circle
        cx="60"
        cy="28"
        r="10"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="var(--color-paper)"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

export function WorkflowDetail({
  workflow,
  runs,
  onRunAgain,
  runningId,
}: WorkflowDetailProps) {
  const reduce = useReducedMotion();
  const [showAllFields, setShowAllFields] = useState(false);

  const blueprint = workflow.blueprint;
  const fields = blueprint?.fields || [];
  const displayFields = showAllFields ? fields : fields.slice(0, 6);
  const hasMoreFields = fields.length > 6;

  const isRunning = runningId === workflow.id;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="space-y-2 border-b border-rule pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={workflow.status === "completed" ? "verified" : "neutral"}>
            {workflow.status}
          </Badge>
          {blueprint?.entity && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft px-2 py-0.5 rounded-xs bg-paper-2 border border-rule">
              {blueprint.entity}
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink font-medium tracking-tight">
          {workflow.title || workflow.prompt}
        </h1>
        <p className="font-mono text-xs text-ink-soft leading-relaxed max-w-prose">
          {workflow.prompt}
        </p>
      </div>

      {/* Blueprint - Read-only with Edit action */}
      <section aria-labelledby="blueprint-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft block font-semibold">
              Blueprint
            </span>
            <h2
              id="blueprint-heading"
              className="font-display text-base text-ink font-medium"
            >
              Collection Schema
            </h2>
          </div>
          <Link href={`/?prompt=${encodeURIComponent(workflow.prompt || "")}`}>
            <Button variant="secondary" size="sm" className="font-mono text-xs gap-1.5">
              <span>Edit Blueprint</span>
              <IconChevron direction="right" className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Fields grid */}
        {fields.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {displayFields.map((f) => (
                <FieldPill key={f.key} label={f.label} required={f.required} />
              ))}
              {hasMoreFields && !showAllFields && (
                <button
                  type="button"
                  onClick={() => setShowAllFields(true)}
                  className="font-mono text-[10px] text-ink-soft hover:text-signal transition-colors px-2 py-1 border border-dashed border-rule rounded-xs"
                >
                  +{fields.length - 6} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Limits */}
        {blueprint?.limits && (
          <div className="flex items-center gap-4 font-mono text-xs text-ink-soft pt-1 border-t border-rule">
            <span>
              Max sources:{" "}
              <span className="text-ink tabular-nums">
                {blueprint.limits.maxSources}
              </span>
            </span>
            <span className="text-rule">|</span>
            <span>
              Max records:{" "}
              <span className="text-ink tabular-nums">
                {blueprint.limits.maxRecords}
              </span>
            </span>
            <span className="text-rule">|</span>
            <span>
              Key fields:{" "}
              <span className="text-ink">
                {blueprint.keyFields.join(", ")}
              </span>
            </span>
          </div>
        )}
      </section>

      {/* Run Again - Primary action */}
      <div className="flex items-center gap-3 py-4 border-y border-rule">
        <Button
          variant="primary"
          size="md"
          onClick={onRunAgain}
          loading={isRunning}
          className="gap-2"
        >
          <IconPlay className="w-4 h-4" />
          <span>Run again</span>
        </Button>
        <p className="font-mono text-xs text-ink-soft">
          Creates a new collection run and links it to the previous for change tracking.
        </p>
      </div>

      {/* Run Trail */}
      <section aria-labelledby="trail-heading" className="space-y-4">
        <div className="space-y-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft block font-semibold">
            Run Trail
          </span>
          <h2
            id="trail-heading"
            className="font-display text-base text-ink font-medium"
          >
            Collection History
          </h2>
        </div>

        {runs.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-4 bg-paper-2/40 border border-rule border-dashed rounded-xs">
            <div className="flex justify-center">
              <EmptyRunIllustration />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base text-ink font-medium">No runs yet</h3>
              <p className="font-mono text-xs text-ink-soft leading-relaxed">
                Start the first collection run to populate the trail.
              </p>
            </div>
          </div>
        ) : (
          <ol role="list" className="relative space-y-0">
            {runs.map((run, idx) => {
              const isLatest = idx === 0;
              const isLast = idx === runs.length - 1;
              const runUrl = `/w/${workflow.id}/runs/${run.id}`;
              const resultsUrl = `${runUrl}/results`;
              const diffUrl = `${runUrl}/diff`;
              const hasDiff = Boolean(run.previousRunId);

              return (
                <li
                  key={run.id}
                  className="flex gap-4 pb-6"
                >
                  {/* Trail markers + line */}
                  <div className="flex flex-col items-center pt-1">
                    <StoneMarker isLatest={isLatest} />
                    {!isLast && (
                      <div
                        aria-hidden="true"
                        className="w-px flex-1 bg-rule mt-2"
                      />
                    )}
                  </div>

                  {/* Run card */}
                  <motion.div
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: idx * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`flex-1 min-w-0 border rounded-xs p-3 space-y-2 ${
                      isLatest
                        ? "border-signal/30 bg-signal/5"
                        : "border-rule bg-paper-2/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          run.status === "complete"
                            ? "verified"
                            : run.status === "failed"
                            ? "reject"
                            : "neutral"
                        }
                      >
                        {run.status}
                      </Badge>
                      {isLatest && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-signal">
                          Latest
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-ink-soft ml-auto flex items-center gap-1">
                        <IconClock className="w-3 h-3" />
                        {formatDate(run.createdAt)}
                      </span>
                    </div>

                    {/* Stats row */}
                    {run.counts && (
                      <div className="flex items-center gap-3 font-mono text-xs text-ink-soft">
                        <span>
                          <span className="text-ink tabular-nums">
                            {run.counts.recordsKept}
                          </span>{" "}
                          records
                        </span>
                        <span className="text-rule">|</span>
                        <span>
                          <span className="text-verified tabular-nums">
                            {run.counts.verified}
                          </span>{" "}
                          verified
                        </span>
                        {run.counts.duplicatesMerged > 0 && (
                          <>
                            <span className="text-rule">|</span>
                            <span>
                              <span className="text-ink tabular-nums">
                                {run.counts.duplicatesMerged}
                              </span>{" "}
                              deduped
                            </span>
                          </>
                        )}
                        {run.startedAt && run.finishedAt && (
                          <>
                            <span className="text-rule">|</span>
                            <span className="tabular-nums">
                              {formatDuration(run.startedAt, run.finishedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {run.status === "complete" && (
                        <Link
                          href={resultsUrl}
                          className="font-mono text-[10px] text-ink-soft hover:text-signal transition-colors flex items-center gap-1"
                        >
                          Results
                          <IconChevron direction="right" className="w-3 h-3" />
                        </Link>
                      )}
                      {run.status !== "complete" && (
                        <Link
                          href={runUrl}
                          className="font-mono text-[10px] text-ink-soft hover:text-signal transition-colors flex items-center gap-1"
                        >
                          View run
                          <IconChevron direction="right" className="w-3 h-3" />
                        </Link>
                      )}
                      {hasDiff && run.status === "complete" && (
                        <Link
                          href={diffUrl}
                          className="font-mono text-[10px] text-caution hover:text-signal transition-colors flex items-center gap-1"
                        >
                          <IconDiff className="w-3 h-3" />
                          Changes vs previous
                        </Link>
                      )}
                    </div>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
