"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconLink } from "@/components/icons/IconLink";
import type { Source } from "@/lib/db/schemas";

export interface SourcesTabProps {
  runId: string;
  className?: string;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({ runId, className = "" }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      try {
        setLoading(true);
        const res = await fetch(`/api/runs/${runId}/sources`);
        if (!res.ok) {
          throw new Error(`Failed to load sources: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setSources(data.items || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (runId) {
      loadSources();
    }

    return () => {
      cancelled = true;
    };
  }, [runId]);

  const formatSize = (bytesOrChars: number | null | undefined) => {
    if (!bytesOrChars) return "n/a";
    if (bytesOrChars < 1024) return `${bytesOrChars} B`;
    return `${(bytesOrChars / 1024).toFixed(1)} KB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "fetched":
        return <Badge variant="verified">Fetched</Badge>;
      case "skipped":
        return <Badge variant="caution">Skipped</Badge>;
      case "failed":
        return <Badge variant="reject">Failed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div
      role="tabpanel"
      aria-label="Permitted Sources"
      className={`space-y-4 ${className}`.trim()}
    >
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
            Provenance Ledger
          </span>
          <h3 className="font-display text-base font-medium text-ink">
            Permitted Web Sources ({sources.length})
          </h3>
        </div>
        <div className="text-xs font-mono text-ink-soft">
          1 req/s per domain
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center font-mono text-xs text-ink" aria-live="polite">
          Loading source provenance ledger...
        </div>
      ) : error ? (
        <div className="p-3 rounded-xs border border-reject/40 bg-reject/5 text-xs text-reject font-mono">
          {error}
        </div>
      ) : sources.length === 0 ? (
        <div className="py-8 text-center text-xs text-ink-soft italic font-mono">
          No sources discovered yet.
        </div>
      ) : (
        <>
          {/* Mobile Specimen Cards (< md) */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {sources.map((s) => (
              <div
                key={s._id || s.url}
                className="p-3 rounded-xs border border-rule bg-paper-2/60 space-y-2 text-xs font-mono"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-ink break-all">
                    {s.domain}
                  </div>
                  {getStatusBadge(s.status)}
                </div>

                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-signal hover:underline inline-flex items-center gap-1 text-[11px] break-all"
                >
                  <span className="truncate max-w-[280px]">{s.url}</span>
                  <IconLink className="w-3 h-3 shrink-0" />
                </a>

                <div className="flex items-center justify-between pt-1 border-t border-rule/60 text-[11px] text-ink-soft">
                  <div className="flex items-center gap-2">
                    <span>
                      Robots:{" "}
                      {s.robots.allowed ? (
                        <span className="text-verified">Allowed</span>
                      ) : (
                        <span className="text-reject">Disallowed</span>
                      )}
                    </span>
                    <span>HTTP: {s.httpStatus || "n/a"}</span>
                  </div>
                  <div>{formatSize(s.textLength)}</div>
                </div>

                {s.snapshot?.url && (
                  <div className="pt-1">
                    <a
                      href={s.snapshot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-ink-soft hover:text-ink underline"
                    >
                      View stored snapshot
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block border border-rule rounded-xs overflow-hidden bg-paper">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-rule bg-paper-2 text-ink-soft uppercase text-[10px] tracking-wider select-none">
                  <th className="py-2.5 px-3 font-medium">Domain & URL</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Robots</th>
                  <th className="py-2.5 px-3 font-medium">HTTP</th>
                  <th className="py-2.5 px-3 font-medium">Size</th>
                  <th className="py-2.5 px-3 font-medium text-right">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/60">
                {sources.map((s) => (
                  <tr key={s._id || s.url} className="hover:bg-ink/5 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-ink">{s.domain}</div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-signal hover:underline inline-flex items-center gap-1 text-[11px] max-w-sm truncate"
                      >
                        <span className="truncate">{s.url}</span>
                        <IconLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="py-2.5 px-3">{getStatusBadge(s.status)}</td>
                    <td className="py-2.5 px-3">
                      {s.robots.allowed ? (
                        <Badge variant="verified">Allowed</Badge>
                      ) : (
                        <Badge variant="reject">Blocked</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums">
                      {s.httpStatus || "n/a"}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums">
                      {formatSize(s.textLength)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {s.snapshot?.url ? (
                        <a
                          href={s.snapshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-signal hover:underline text-[11px]"
                        >
                          Snapshot
                        </a>
                      ) : (
                        <span className="text-ink-soft">none</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
