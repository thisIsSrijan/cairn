"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CairnMark } from "@/components/brand/CairnMark";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for inspection
    console.error("Cairn application error boundary caught:", error);
  }, [error]);

  return (
    <main className="min-h-[80dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-paper border border-rule rounded-xs p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3 pb-4 border-b border-rule mb-6">
          <div className="p-2 border border-rule rounded-xs text-signal">
            <CairnMark className="w-6 h-6" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-reject font-medium">
              System Interruption
            </div>
            <h1 className="font-display text-xl text-ink font-medium">
              Execution Fault
            </h1>
          </div>
        </div>

        <p className="text-sm text-ink-soft leading-relaxed mb-4">
          An unexpected interruption occurred during ledger execution. The stored records and snapshots remain intact.
        </p>

        {error.message && (
          <div className="p-3 bg-surface-2 border border-rule rounded-xs font-mono text-xs text-ink-soft break-words mb-6">
            <span className="text-ink font-medium">Error:</span> {error.message}
            {error.digest && (
              <div className="mt-1 text-[11px] text-ink-soft/75">
                Digest: {error.digest}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="primary" onClick={reset}>
            Retry Operation
          </Button>
          <Link href="/">
            <Button variant="secondary">
              Return to Ledger
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
