"use client";

import React, { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { IconDownload } from "@/components/icons/IconDownload";
import { IconLink } from "@/components/icons/IconLink";
import { IconCheck } from "@/components/icons/IconCheck";

export interface ExportResultData {
  id: string;
  format: "csv" | "json" | "xlsx";
  url: string;
  rows: number;
}

export interface ExportSheetProps {
  open: boolean;
  onClose: () => void;
  runId?: string;
  onExport: (format: "csv" | "json" | "xlsx") => Promise<ExportResultData>;
}

export const ExportSheet: React.FC<ExportSheetProps> = ({
  open,
  onClose,
  onExport,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "json" | "xlsx">("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResultData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const exp = await onExport(selectedFormat);
      setResult(exp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compile export file");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.url) return;
    try {
      const fullUrl =
        result.url.startsWith("http://") || result.url.startsWith("https://")
          ? result.url
          : `${window.location.origin}${result.url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={handleClose} title="Export Dataset">
      <div className="p-4 sm:p-5 space-y-5 font-mono text-xs text-ink">
        {/* Provenance one-liner notice */}
        <div className="p-3 bg-paper-2 border border-rule rounded-xs">
          <p className="text-ink-soft text-xs leading-relaxed">
            Every field includes a corresponding provenance source URL column ({`{field}__source`}).
          </p>
        </div>

        {!result ? (
          <>
            {/* Format Selection Cards */}
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
                Select Export Format
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { key: "csv", label: "CSV", sub: "Tabular text" },
                    { key: "json", label: "JSON", sub: "Structured objects" },
                    { key: "xlsx", label: "XLSX", sub: "Excel workbook" },
                  ] as const
                ).map((fmt) => {
                  const isSelected = selectedFormat === fmt.key;
                  return (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => setSelectedFormat(fmt.key)}
                      disabled={isExporting}
                      className={`p-3 rounded-xs border text-left cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-ink text-paper border-ink"
                          : "bg-paper text-ink border-rule hover:border-signal"
                      }`}
                    >
                      <span className="font-semibold block text-sm">
                        {fmt.label}
                      </span>
                      <span
                        className={`text-[10px] block mt-0.5 ${
                          isSelected ? "text-paper/70" : "text-ink-soft"
                        }`}
                      >
                        {fmt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-cairn-reject/10 border border-cairn-reject/30 text-cairn-reject rounded-xs text-xs">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={handleClose}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteExport}
                loading={isExporting}
                className="gap-1.5"
              >
                <IconDownload className="w-4 h-4" />
                <span>
                  {isExporting ? "Compiling ledger export..." : "Generate Export"}
                </span>
              </Button>
            </div>
          </>
        ) : (
          /* Export Complete View */
          <div className="space-y-4">
            <div className="p-4 bg-cairn-verified/10 border border-cairn-verified/30 rounded-xs space-y-1">
              <div className="flex items-center gap-2 text-cairn-verified font-semibold text-sm">
                <IconCheck className="w-4 h-4" />
                <span>Export Compiled Successfully</span>
              </div>
              <p className="text-ink-soft text-xs">
                {result.rows} records packaged with receipt provenance columns.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <a
                href={result.url}
                download
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-signal text-paper font-mono text-xs uppercase tracking-wider font-semibold rounded-xs hover:opacity-95 transition-opacity"
              >
                <IconDownload className="w-4 h-4" />
                <span>Download {result.format.toUpperCase()}</span>
              </a>

              <Button
                variant="secondary"
                size="md"
                onClick={handleCopyLink}
                className="gap-2 shrink-0"
              >
                {copied ? (
                  <>
                    <IconCheck className="w-4 h-4 text-cairn-verified" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <IconLink className="w-4 h-4" />
                    <span>Copy Download Link</span>
                  </>
                )}
              </Button>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="quiet" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
