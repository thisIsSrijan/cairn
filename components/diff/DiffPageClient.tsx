"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RunDiffResult } from "@/lib/pipeline/diff";
import type { RecordDoc, Workflow } from "@/lib/db/schemas";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { ReceiptDrawer, type ReceiptDetailData } from "@/components/results/ReceiptDrawer";
import { IconDiff } from "@/components/icons/IconDiff";
import { IconChevron } from "@/components/icons/IconChevron";

interface DiffPageClientProps {
  workflowId: string;
  runId: string;
}

export function DiffPageClient({ workflowId, runId }: DiffPageClientProps) {
  const [diff, setDiff] = useState<RunDiffResult | null>(null);
  const [workflow, setWorkflow] = useState<(Workflow & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Receipt drawer state
  const [selectedRecord, setSelectedRecord] = useState<(RecordDoc & { id: string }) | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetailData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [diffRes, wfRes] = await Promise.all([
          fetch(`/api/runs/${runId}/diff`),
          fetch(`/api/workflows/${workflowId}`),
        ]);

        if (!diffRes.ok) throw new Error(`Diff load failed: ${diffRes.status}`);
        if (!wfRes.ok) throw new Error(`Workflow load failed: ${wfRes.status}`);

        const [diffData, wfData] = await Promise.all([diffRes.json(), wfRes.json()]);

        if (isMounted) {
          setDiff(diffData);
          setWorkflow(wfData);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [runId, workflowId]);

  const handleSelectReceipt = async (
    record: RecordDoc & { id: string },
    fieldKey: string
  ) => {
    setSelectedRecord(record);
    setSelectedField(fieldKey);
    setIsDrawerOpen(true);
    setLoadingReceipt(true);
    setReceiptDetail(null);

    try {
      const res = await fetch(`/api/records/${record.id}/receipts/${fieldKey}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptDetail(data);
      } else {
        const localReceipt = record.receipts?.[fieldKey];
        if (localReceipt) {
          setReceiptDetail({
            receipt: localReceipt,
            location: null,
            window: null,
            source: {
              id: localReceipt.sourceId,
              url: "",
              domain: "Source",
              fetchedAt: localReceipt.extractedAt,
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to load receipt:", err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const fields =
    workflow?.blueprint?.fields?.map((f) => ({ key: f.key, label: f.label })) || [];

  if (loading) {
    return (
      <div className="py-20 text-center space-y-2 font-mono text-xs text-ink-soft" aria-live="polite">
        <div className="w-5 h-5 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Computing run diff...</p>
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="p-6 border border-reject/30 bg-reject/5 rounded-xs font-mono text-xs text-reject">
        {error || "Failed to load diff."}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-ink-soft">
        <Link href="/tasks" className="hover:text-ink transition-colors">
          Tasks
        </Link>
        <span className="text-rule">/</span>
        <Link href={`/w/${workflowId}`} className="hover:text-ink transition-colors">
          Workflow
        </Link>
        <span className="text-rule">/</span>
        <Link
          href={`/w/${workflowId}/runs/${runId}/results`}
          className="hover:text-ink transition-colors"
        >
          Results
        </Link>
        <span className="text-rule">/</span>
        <span className="text-ink font-semibold">Changes</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <IconDiff className="w-4 h-4 text-ink-soft" />
            <span className="font-mono text-xs uppercase tracking-wider text-ink-soft font-semibold">
              Run Diff
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink font-medium tracking-tight">
            Run Changes
          </h1>
          {workflow && (
            <p className="font-mono text-xs text-ink-soft">
              {workflow.title || workflow.prompt}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/w/${workflowId}/runs/${runId}/results`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-soft hover:text-signal transition-colors border border-rule rounded-xs px-3 py-2 bg-paper hover:bg-paper-2"
          >
            <span>View Results</span>
            <IconChevron direction="right" className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Diff Viewer */}
      <DiffViewer
        diff={diff}
        fields={fields}
        workflowId={workflowId}
        runId={runId}
        onSelectReceipt={handleSelectReceipt}
      />

      {/* Receipt Drawer */}
      <ReceiptDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
        field={selectedField}
        receiptDetail={receiptDetail}
        loading={loadingReceipt}
      />
    </div>
  );
}
