"use client";

import React, { useReducer, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconPlay } from "@/components/icons/IconPlay";
import type { Workflow } from "@/lib/db/schemas";

type WorkflowWithId = Workflow & { id: string };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; workflows: Workflow[]; launchingId: string | null };

type Action =
  | { type: "loaded"; workflows: Workflow[] }
  | { type: "error"; message: string }
  | { type: "launching"; id: string }
  | { type: "launch_failed"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return {
        status: "loaded",
        workflows: action.workflows,
        launchingId: state.status === "loaded" ? state.launchingId : null,
      };
    case "error":
      return { status: "error", message: action.message };
    case "launching":
      if (state.status !== "loaded") return state;
      return { ...state, launchingId: action.id };
    case "launch_failed":
      if (state.status !== "loaded") return state;
      return { ...state, launchingId: null };
    default:
      return state;
  }
}

export const TasksLedger: React.FC = () => {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, { status: "loading" });

  const loadWorkflows = useCallback(() => {
    fetch("/api/workflows")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load workflows: ${res.status}`);
        return res.json();
      })
      .then((data) => dispatch({ type: "loaded", workflows: data.items || [] }))
      .catch((err) =>
        dispatch({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        })
      );
  }, [dispatch]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleRunAgain = async (wf: Workflow) => {
    if (state.status !== "loaded") return;
    const wfId = (wf as WorkflowWithId).id;
    if (!wfId || state.launchingId) return;

    dispatch({ type: "launching", id: wfId });
    try {
      const res = await fetch(`/api/workflows/${wfId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limits: wf.blueprint.limits }),
      });

      if (!res.ok) throw new Error(`Failed to launch run: ${res.status}`);

      const run = await res.json();
      const runId = run.id || run._id;
      router.push(`/w/${wfId}/runs/${runId}`);
    } catch (err) {
      dispatch({
        type: "launch_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "recently";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (state.status === "loading") {
    return (
      <div className="py-16 text-center font-mono text-xs text-ink" aria-live="polite">
        Reading workflow ledger entries...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4 border border-reject/40 bg-reject/5 rounded-xs text-reject font-mono text-xs">
        {state.message}
      </div>
    );
  }

  const { workflows, launchingId } = state;

  if (workflows.length === 0) {
    return (
      <div className="py-12 px-4 border border-rule border-dashed rounded-xs text-center space-y-5 bg-paper-2/40 max-w-lg mx-auto">
        {/* Small Cairn trail marker SVG */}
        <div className="flex justify-center" aria-hidden="true">
          <svg
            viewBox="0 0 100 80"
            className="w-20 h-16 text-ink-soft"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 10 70 Q 50 68 90 70"
              stroke="var(--color-rule)"
              strokeWidth="1.5"
            />
            <rect
              x="25"
              y="52"
              width="50"
              height="14"
              rx="4"
              fill="var(--color-paper)"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <rect
              x="32"
              y="38"
              width="36"
              height="13"
              rx="3.5"
              fill="var(--color-paper)"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <circle
              cx="50"
              cy="28"
              r="6"
              fill="var(--color-signal)"
              stroke="var(--color-signal)"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="space-y-1">
          <h3 className="font-display text-lg text-ink font-medium">
            No collection tasks recorded
          </h3>
          <p className="text-xs text-ink-soft max-w-sm mx-auto leading-relaxed">
            Describe what web data you need in plain English to formulate your first verified dataset blueprint.
          </p>
        </div>

        <div>
          <Link href="/">
            <Button variant="primary" size="md">
              Ask in plain English
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-rule pb-2 text-ink-soft font-mono text-xs uppercase tracking-wider select-none">
        <span>Recorded Workflows ({workflows.length})</span>
        <span>Actions</span>
      </div>

      <div className="divide-y divide-rule/70 border-b border-rule">
      {workflows.map((wf, idx) => {
          const wfId = (wf as WorkflowWithId).id || "";
          const rowKey = wfId || `wf-${idx}`;
          const targetUrl = wf.latestRunId
            ? `/w/${wfId}/runs/${wf.latestRunId}`
            : `/w/${wfId}/runs/latest`;

          return (
            <div
              key={rowKey}
              className="py-4 px-2 hover:bg-ink/5 transition-colors duration-fast flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              {/* Left: Title, metadata, progress */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={wf.status === "ready" ? "verified" : "neutral"}>
                    {wf.status}
                  </Badge>
                  <span className="font-mono text-[11px] text-ink-soft tabular-nums">
                    Updated {formatDate(wf.updatedAt)}
                  </span>
                </div>

                <Link
                  href={targetUrl}
                  className="block font-display text-lg text-ink group-hover:text-signal transition-colors font-medium truncate"
                >
                  {wf.title || wf.prompt}
                </Link>

                <div className="flex items-center gap-3 text-xs font-mono text-ink-soft">
                  <span>Entity: {wf.blueprint?.entity || "Item"}</span>
                  <span className="text-rule">•</span>
                  <span>{wf.blueprint?.fields?.length || 0} fields</span>
                  <span className="text-rule">•</span>
                  <span>Limit: {wf.blueprint?.limits?.maxRecords || 25} records</span>
                </div>

                {/* Thin progress rule */}
                <div className="h-0.5 w-full bg-rule/50 rounded-full mt-2" />
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={launchingId === wfId}
                  disabled={launchingId !== null}
                  onClick={() => handleRunAgain(wf)}
                  className="font-mono text-xs gap-1"
                >
                  <IconPlay className="w-3.5 h-3.5" />
                  <span>Run again</span>
                </Button>

                {wf.latestRunId && (
                  <Link href={`/w/${wfId}/runs/${wf.latestRunId}`}>
                    <Button size="sm" variant="quiet" className="font-mono text-xs">
                      Inspect
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
