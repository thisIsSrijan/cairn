"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowDetail } from "@/components/workflow/WorkflowDetail";
import type { Workflow, Run } from "@/lib/db/schemas";

interface WorkflowDetailPageClientProps {
  id: string;
}

export function WorkflowDetailPageClient({ id }: WorkflowDetailPageClientProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<(Workflow & { id: string }) | null>(null);
  const [runs, setRuns] = useState<(Run & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [wfRes, runsRes] = await Promise.all([
          fetch(`/api/workflows/${id}`),
          fetch(`/api/runs?workflowId=${id}&limit=20`).catch(() => null),
        ]);

        if (!wfRes.ok) {
          throw new Error(`Workflow not found: ${wfRes.status}`);
        }
        const wfData = await wfRes.json();

        let runsData: (Run & { id: string })[] = [];
        if (runsRes && runsRes.ok) {
          const rd = await runsRes.json();
          runsData = rd.items || [];
        }

        if (isMounted) {
          setWorkflow(wfData);
          setRuns(runsData);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleRunAgain = async () => {
    if (!workflow || runningId) return;
    setRunningId(workflow.id);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Failed to create run: ${res.status}`);
      const run = await res.json();
      const runId = run.id || run._id;
      router.push(`/w/${workflow.id}/runs/${runId}`);
    } catch (err) {
      console.error("Run again failed:", err);
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-2 font-mono text-xs text-ink-soft" aria-live="polite">
        <div className="w-5 h-5 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading workflow blueprint...</p>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-6 border border-reject/30 bg-reject/5 rounded-xs font-mono text-xs text-reject">
        {error || "Workflow not found."}
      </div>
    );
  }

  return (
    <WorkflowDetail
      workflow={workflow}
      runs={runs}
      onRunAgain={handleRunAgain}
      runningId={runningId}
    />
  );
}
