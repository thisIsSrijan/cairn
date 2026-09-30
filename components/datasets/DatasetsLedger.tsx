"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Workflow } from "@/lib/db/schemas";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconDatasets } from "@/components/icons/IconDatasets";
import { IconChevron } from "@/components/icons/IconChevron";

export const DatasetsLedger: React.FC = () => {
  const [workflows, setWorkflows] = useState<(Workflow & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="py-16 text-center space-y-3 bg-paper-2/40 border border-rule border-dashed rounded-xs font-mono text-xs text-ink-soft">
        <div className="w-5 h-5 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading verified datasets...</p>
      </div>
    );
  }

  if (completedWorkflows.length === 0) {
    return (
      <div className="p-8 border border-rule border-dashed rounded-xs text-center space-y-4 bg-paper-2/40 max-w-lg mx-auto">
        <div className="flex justify-center" aria-hidden="true">
          <IconDatasets className="w-10 h-10 text-ink-soft" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg text-ink font-medium">
            No datasets collected yet
          </h2>
          <p className="text-xs font-mono text-ink-soft leading-relaxed">
            Every cell in Cairn carries verifiable receipt evidence located in its original web source snapshot.
          </p>
        </div>
        <Link href="/">
          <Button variant="secondary" size="sm">
            Plan your first dataset
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-rule rounded-xs bg-paper divide-y divide-rule font-mono text-xs">
      {completedWorkflows.map((wf) => {
        const resultsUrl = `/w/${wf.id}/runs/${wf.latestRunId}/results`;

        return (
          <div
            key={wf.id}
            className="p-4 sm:p-5 hover:bg-ink/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={wf.status === "completed" ? "verified" : "neutral"}>
                  {wf.status}
                </Badge>
                {wf.blueprint?.entity && (
                  <span className="text-[11px] text-ink-soft">
                    Entity: {wf.blueprint.entity}
                  </span>
                )}
              </div>

              <Link
                href={resultsUrl}
                className="block font-display text-lg text-ink group-hover:text-signal transition-colors font-medium truncate"
              >
                {wf.title || wf.prompt}
              </Link>

              <div className="flex items-center gap-3 text-[11px] text-ink-soft">
                <span>{wf.blueprint?.fields?.length || 0} fields with receipts</span>
                <span className="text-rule">•</span>
                <span>Limit: {wf.blueprint?.limits?.maxRecords || 25} records</span>
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              <Link href={resultsUrl}>
                <Button variant="secondary" size="sm" className="gap-1.5 font-mono text-xs">
                  <span>Open Results</span>
                  <IconChevron direction="right" className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
};
