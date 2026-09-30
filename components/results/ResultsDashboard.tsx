"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Workflow, Run, RecordDoc } from "@/lib/db/schemas";
import { SummaryStrip } from "./SummaryStrip";
import { FilterBar, type FilterState } from "./FilterBar";
import { SpecimenCard } from "./SpecimenCard";
import { RecordsTable } from "./RecordsTable";
import { ReceiptDrawer, type ReceiptDetailData } from "./ReceiptDrawer";
import { ExportSheet, type ExportResultData } from "./ExportSheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconDownload } from "@/components/icons/IconDownload";
import { IconRefresh } from "@/components/icons/IconRefresh";
import { IconDatasets } from "@/components/icons/IconDatasets";

export interface ResultsDashboardProps {
  workflowId: string;
  runId: string;
  initialRun?: Run & { id: string };
  initialWorkflow?: Workflow & { id: string };
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  workflowId,
  runId,
  initialRun,
  initialWorkflow,
}) => {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Core metadata state
  const [run, setRun] = useState<(Run & { id: string }) | null>(initialRun || null);
  const [workflow, setWorkflow] = useState<(Workflow & { id: string }) | null>(
    initialWorkflow || null
  );
  const [, setLoadingRun] = useState(!initialRun || !initialWorkflow);

  // Records and source state
  const [records, setRecords] = useState<(RecordDoc & { id: string })[]>([]);
  const [sourceDomains, setSourceDomains] = useState<Record<string, string>>({});
  const [domains, setDomains] = useState<string[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // Filters and sort state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    minConfidence: 0,
    sourceDomain: "",
    fieldPresence: "",
  });
  const [sort, setSort] = useState<string>("confidence_desc");

  // Receipt Drawer state
  const [selectedRecord, setSelectedRecord] = useState<(RecordDoc & { id: string }) | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<ReceiptDetailData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Export Sheet state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // 1. Fetch Run, Workflow, and Sources metadata
  useEffect(() => {
    let isMounted = true;

    async function loadMeta() {
      try {
        setLoadingRun(true);
        const [runRes, wfRes, srcRes] = await Promise.all([
          fetch(`/api/runs/${runId}`),
          fetch(`/api/workflows/${workflowId}`),
          fetch(`/api/runs/${runId}/sources`),
        ]);

        if (runRes.ok) {
          const runData = await runRes.json();
          if (isMounted) setRun(runData);
        }

        if (wfRes.ok) {
          const wfData = await wfRes.json();
          if (isMounted) setWorkflow(wfData);
        }

        if (srcRes.ok) {
          const srcData = await srcRes.json();
          const items = srcData.items || [];
          const domainMap: Record<string, string> = {};
          const uniqueDomains = new Set<string>();

          for (const s of items) {
            const sid = s.id || s._id;
            if (sid && s.domain) {
              domainMap[sid] = s.domain;
              uniqueDomains.add(s.domain);
            }
          }

          if (isMounted) {
            setSourceDomains(domainMap);
            setDomains(Array.from(uniqueDomains));
          }
        }
      } catch (err) {
        console.error("Failed to load run metadata:", err);
      } finally {
        if (isMounted) setLoadingRun(false);
      }
    }

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [runId, workflowId]);

  // 2. Fetch Records based on search, status, confidence, and sort
  // Defined as a local async function inside useEffect to comply with react-hooks/set-state-in-effect
  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      setLoadingRecords(true);
      setRecordsError(null);

      try {
        const params = new URLSearchParams();
        if (filters.search.trim()) {
          params.set("q", filters.search.trim());
        }
        if (filters.status !== "all") {
          params.set("status", filters.status);
        }
        if (filters.minConfidence > 0) {
          params.set("minConfidence", String(filters.minConfidence));
        }
        if (sort) {
          params.set("sort", sort);
        }
        params.set("limit", "100");

        const res = await fetch(`/api/runs/${runId}/records?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load ledger records");
        }

        const data = await res.json();
        let items: (RecordDoc & { id: string })[] = data.items || [];

        // Filter client-side by domain if chosen
        if (filters.sourceDomain) {
          items = items.filter((rec) => {
            for (const r of Object.values(rec.receipts || {})) {
              if (r.sourceId && sourceDomains[r.sourceId] === filters.sourceDomain) {
                return true;
              }
            }
            return false;
          });
        }

        // Filter client-side by field presence if chosen
        if (filters.fieldPresence) {
          items = items.filter((rec) => {
            const val = rec.values[filters.fieldPresence];
            return val !== undefined && val !== null && String(val).trim() !== "";
          });
        }

        if (isMounted) setRecords(items);
      } catch (err) {
        if (isMounted)
          setRecordsError(err instanceof Error ? err.message : "Error loading records");
      } finally {
        if (isMounted) setLoadingRecords(false);
      }
    }

    void loadRecords();
    return () => {
      isMounted = false;
    };
  }, [runId, filters, sort, sourceDomains]);

  // 3. Receipt Selection Handler
  const handleSelectReceipt = async (record: RecordDoc & { id: string }, fieldKey: string) => {
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
        // Fallback to record local receipt
        const localReceipt = record.receipts?.[fieldKey];
        if (localReceipt) {
          const srcId = localReceipt.sourceId;
          const dom = sourceDomains[srcId] || "Permitted Source";
          setReceiptDetail({
            receipt: localReceipt,
            location: null,
            window: null,
            source: {
              id: srcId,
              url: `https://${dom}`,
              domain: dom,
              fetchedAt: localReceipt.extractedAt,
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to load receipt detail:", err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // 4. Export Handler
  const handleExport = async (format: "csv" | "json" | "xlsx"): Promise<ExportResultData> => {
    const res = await fetch(`/api/runs/${runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "Export generation failed");
    }

    const data = await res.json();
    const downloadUrl = data.url?.startsWith("memory://")
      ? `/api/exports/${data.id}/download`
      : data.url;

    return {
      id: data.id,
      format: data.format,
      url: downloadUrl,
      rows: data.rows,
    };
  };

  // 5. Retry Collection Handler (for failed runs)
  const handleRetryRun = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        startTransition(() => {
          router.push(`/w/${workflowId}/runs/${data.id || data.run?.id}`);
        });
      }
    } catch (err) {
      console.error("Retry run failed:", err);
    } finally {
      setIsRetrying(false);
    }
  };

  const fields =
    workflow?.blueprint?.fields?.map((f) => ({ key: f.key, label: f.label })) || [];
  const keyField = workflow?.blueprint?.keyFields?.[0] || fields[0]?.key || "title";
  const counts = run?.counts || {
    sourcesFound: 0,
    sourcesFetched: 0,
    valuesExtracted: 0,
    valuesRejected: 0,
    recordsKept: 0,
    duplicatesMerged: 0,
    verified: 0,
    unverified: 0,
  };

  const isFailed = run?.status === "failed";
  const hasZeroRecords = !loadingRecords && records.length === 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-ink-soft">
          <Link href="/tasks" className="hover:text-ink transition-colors">
            Tasks
          </Link>
          <span className="text-rule">/</span>
          <Link
            href={`/w/${workflowId}/runs/${runId}`}
            className="hover:text-ink transition-colors"
          >
            Run Log
          </Link>
          <span className="text-rule">/</span>
          <span className="text-ink font-semibold">Results Dashboard</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft font-semibold">
                Ledger Results
              </span>
              <Badge variant={isFailed ? "reject" : "verified"}>
                {run?.status || "complete"}
              </Badge>
              {workflow?.blueprint?.entity && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-paper-2 border border-rule text-ink">
                  Entity: {workflow.blueprint.entity}
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl text-ink font-medium tracking-tight">
              {workflow?.title || workflow?.prompt || "Collection Results"}
            </h1>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/w/${workflowId}/runs/${runId}`}>
              <Button variant="secondary" size="md" className="font-mono text-xs gap-1.5">
                <span>View Field Log</span>
              </Button>
            </Link>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsExportOpen(true)}
              disabled={counts.recordsKept === 0 && records.length === 0}
              className="gap-1.5"
            >
              <IconDownload className="w-4 h-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <SummaryStrip counts={counts} />

      {/* Failed Run Partial State */}
      {isFailed && (
        <div className="p-5 bg-cairn-reject/10 border border-cairn-reject/30 rounded-xs space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-cairn-reject font-bold text-sm">
            <span>Collection Halted on Error</span>
          </div>
          <p className="text-ink text-xs leading-relaxed">
            {run?.error || "The state machine encountered an unrecoverable batch error during collection."}
          </p>
          <div className="pt-1">
            <Button
              variant="primary"
              size="sm"
              loading={isRetrying}
              onClick={handleRetryRun}
              className="gap-1.5"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Retry Collection Run</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <FilterBar
        filters={filters}
        fields={fields}
        domains={domains}
        onFilterChange={setFilters}
      />

      {/* Records Content */}
      {loadingRecords ? (
        <div className="py-16 text-center space-y-3 bg-paper-2/40 border border-rule border-dashed rounded-xs">
          <div className="w-6 h-6 border-2 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs text-ink-soft">
            Querying text index and verifiable receipts...
          </p>
        </div>
      ) : recordsError ? (
        <div className="p-6 text-center text-cairn-reject font-mono text-xs bg-cairn-reject/5 border border-cairn-reject/20 rounded-xs">
          {recordsError}
        </div>
      ) : hasZeroRecords ? (
        /* Empty Records State */
        <div className="py-16 px-4 text-center space-y-4 bg-paper-2/40 border border-rule border-dashed rounded-xs max-w-lg mx-auto">
          <div className="flex justify-center" aria-hidden="true">
            <IconDatasets className="w-10 h-10 text-ink-soft" />
          </div>

          <div className="space-y-1.5">
            <h3 className="font-display text-lg text-ink font-medium">
              No matching records in ledger
            </h3>
            <p className="font-mono text-xs text-ink-soft leading-relaxed">
              {filters.search || filters.status !== "all" || filters.minConfidence > 0
                ? "No entries matched your active filters. Clear search or relax confidence requirements."
                : `0 records kept from ${counts.sourcesFetched} permitted sources fetched. ${
                    counts.valuesRejected > 0
                      ? `${counts.valuesRejected} candidate values were rejected by the verbatim evidence gate because exact textual matches could not be located in stored page snapshots.`
                      : "The permitted sources returned no extractable candidate values for the requested entity."
                  }`}
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-2">
            {filters.search || filters.status !== "all" || filters.minConfidence > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setFilters({
                    search: "",
                    status: "all",
                    minConfidence: 0,
                    sourceDomain: "",
                    fieldPresence: "",
                  })
                }
              >
                Clear all filters
              </Button>
            ) : (
              <Link href="/">
                <Button variant="secondary" size="sm">
                  Adjust Blueprint in Ask
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        /* Records List View */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-ink-soft">
            <span>
              Showing {records.length} {records.length === 1 ? "record" : "records"}
            </span>
            <span className="text-[11px]">
              Tap any value cell to inspect verbatim receipt evidence
            </span>
          </div>

          {/* Desktop Table View (>= md breakpoint) */}
          <div className="hidden md:block">
            <RecordsTable
              records={records}
              fields={fields}
              sourceDomains={sourceDomains}
              sort={sort}
              onSortChange={setSort}
              onSelectReceipt={handleSelectReceipt}
            />
          </div>

          {/* Mobile Specimen Cards (< md breakpoint) */}
          <div className="md:hidden space-y-3">
            {records.map((rec) => {
              // Find first source domain for record
              let domain = "";
              for (const r of Object.values(rec.receipts || {})) {
                if (r.sourceId && sourceDomains[r.sourceId]) {
                  domain = sourceDomains[r.sourceId];
                  break;
                }
              }

              return (
                <SpecimenCard
                  key={rec.id}
                  record={rec}
                  fields={fields}
                  keyField={keyField}
                  sourceDomain={domain}
                  onSelectReceipt={handleSelectReceipt}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Export Action for Mobile */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsExportOpen(true)}
          className="shadow-xl gap-2 font-mono text-xs uppercase tracking-wider"
        >
          <IconDownload className="w-4 h-4" />
          <span>Export</span>
        </Button>
      </div>

      {/* Receipt Drawer */}
      <ReceiptDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
        field={selectedField}
        receiptDetail={receiptDetail}
        loading={loadingReceipt}
      />

      {/* Export Sheet */}
      <ExportSheet
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        runId={runId}
        onExport={handleExport}
      />
    </div>
  );
};
