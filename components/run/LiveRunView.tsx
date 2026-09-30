"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CairnBuilder } from "./CairnBuilder";
import type { RunStage } from "@/lib/db/schemas";
import { StatRow } from "./StatRow";
import { FieldLog } from "./FieldLog";
import { SourcesTab } from "./SourcesTab";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { IconPause } from "@/components/icons/IconPause";
import { IconPlay } from "@/components/icons/IconPlay";
import { IconStop } from "@/components/icons/IconStop";
import { IconDatasets } from "@/components/icons/IconDatasets";
import { useRunDriver } from "@/hooks/useRunDriver";
import type { Run } from "@/lib/db/schemas";

export interface LiveRunViewProps {
  workflowId: string;
  runId: string;
  initialRun?: Run | null;
}

export const LiveRunView: React.FC<LiveRunViewProps> = ({
  workflowId,
  runId,
  initialRun = null,
}) => {
  const [activeTab, setActiveTab] = useState<"log" | "sources">("log");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const {
    run,
    counts,
    events,
    isTerminal,
    isPaused,
    pause,
    resume,
    cancel,
    error,
  } = useRunDriver(runId, {
    initialRun,
    pollingIntervalMs: 800,
  });

  const currentStage = (run?.stage || "planning") as RunStage;
  const isComplete = run?.status === "complete";

  const getStatusBadge = () => {
    if (isComplete) return <Badge variant="verified">Complete</Badge>;
    if (run?.status === "paused") return <Badge variant="caution">Paused</Badge>;
    if (run?.status === "cancelled") return <Badge variant="reject">Cancelled</Badge>;
    if (run?.status === "failed") return <Badge variant="reject">Failed</Badge>;
    return <Badge variant="caution" dot={true}>Running</Badge>;
  };

  const handleConfirmCancel = async () => {
    await cancel();
    setShowCancelConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
              Workflow {workflowId.slice(-6)}
            </span>
            {getStatusBadge()}
          </div>

          <h1 className="font-display text-2xl md:text-3xl text-ink font-medium">
            Collection Run
          </h1>

          <div className="flex items-center gap-3 text-xs font-mono text-ink-soft mt-1">
            <span>Run ID: {runId}</span>
            <span className="text-rule">•</span>
            <span className="capitalize">Stage: {currentStage}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <>
              {isPaused ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={resume}
                  className="gap-1 font-mono text-xs"
                >
                  <IconPlay className="w-3.5 h-3.5" />
                  <span>Resume collection</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={pause}
                  className="gap-1 font-mono text-xs"
                >
                  <IconPause className="w-3.5 h-3.5" />
                  <span>Pause collection</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="quiet"
                onClick={() => setShowCancelConfirm(true)}
                className="gap-1 font-mono text-xs text-ink-soft hover:text-reject"
              >
                <IconStop className="w-3.5 h-3.5" />
                <span>Cancel collection</span>
              </Button>
            </>
          )}

          {isComplete && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Link href={`/w/${workflowId}/runs/${runId}/results`}>
                <Button
                  variant="primary"
                  size="md"
                  className="gap-1.5 font-mono text-xs shadow-md"
                >
                  <IconDatasets className="w-4 h-4" />
                  <span>Open results</span>
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="p-3 border border-reject/40 bg-reject/5 rounded-xs text-xs text-reject font-mono">
          Pipeline driver warning: {error.message} (retrying with exponential backoff)
        </div>
      )}

      {/* Hero stage visualizer: CairnBuilder + current stage callout */}
      <div className="p-4 sm:p-6 border border-rule rounded-xs bg-paper-2/40 flex flex-col md:flex-row items-center justify-around gap-6">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <CairnBuilder currentStage={currentStage} isComplete={isComplete} size="md" />
          <div className="font-mono text-xs text-ink-soft uppercase tracking-wider">
            {isComplete ? "Cairn Settled (Complete)" : `Stage: ${currentStage}`}
          </div>
        </div>

        <div className="max-w-md space-y-2.5 text-center md:text-left">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-signal shrink-0"
              aria-hidden="true"
            />
            <span className="font-mono text-xs uppercase tracking-wider text-ink font-semibold">
              {isComplete ? "Verification Concluded" : "Live State Machine"}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-ink font-medium">
            {isComplete
              ? "All evidence quotes validated."
              : `Executing ${currentStage} stage.`}
          </h2>
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
            {isComplete
              ? "Every cell in this dataset carries a verified verbatim receipt located in its source snapshot."
              : "Bounded batches advance automatically. The state machine persists its cursor in MongoDB after every step."}
          </p>

          {isComplete && (
            <div className="pt-2">
              <Link href={`/w/${workflowId}/runs/${runId}/results`}>
                <Button variant="primary" size="md" className="gap-2">
                  <IconDatasets className="w-4 h-4" />
                  <span>Inspect Verified Dataset</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Live tabular stats row */}
      <StatRow counts={counts} />

      {/* Tab Switcher: Field Log vs Permitted Sources */}
      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="Run inspection tabs"
          className="flex items-center gap-1 border-b border-rule pb-px"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "log"}
            onClick={() => setActiveTab("log")}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
              activeTab === "log"
                ? "border-signal text-ink font-semibold"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            Field Log
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sources"}
            onClick={() => setActiveTab("sources")}
            className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "sources"
                ? "border-signal text-ink font-semibold"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <span>Permitted Sources</span>
            <span className="text-[10px] bg-ink/5 px-1.5 py-0.5 rounded-xs">
              {counts.sourcesFound}
            </span>
          </button>
        </div>

        {/* Tab panels */}
        {activeTab === "log" ? (
          <FieldLog events={events} />
        ) : (
          <SourcesTab runId={runId} />
        )}
      </div>

      {/* Cancel Confirmation Sheet */}
      <Sheet
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel collection run?"
      >
        <div className="space-y-5 py-2">
          <p className="text-sm text-ink-soft leading-relaxed">
            Are you sure you want to cancel this collection task? Any verified
            records collected up to this batch will be preserved in the dataset ledger.
          </p>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-rule">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep collecting
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmCancel}
              className="bg-reject text-white hover:bg-reject/90"
            >
              Confirm cancellation
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
