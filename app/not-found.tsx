import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CairnMark } from "@/components/brand/CairnMark";

export default function NotFound() {
  return (
    <main className="min-h-[80dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-paper border border-rule rounded-xs p-6 md:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3 pb-4 border-b border-rule mb-6">
          <div className="p-2 border border-rule rounded-xs text-signal">
            <CairnMark className="w-6 h-6" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              Waypoint Error: 404
            </div>
            <h1 className="font-display text-xl text-ink font-medium">
              Record Not Found
            </h1>
          </div>
        </div>

        <p className="text-sm text-ink-soft leading-relaxed mb-6">
          The requested coordinate, workflow, or dataset does not exist in this workspace ledger. Verify the link identifier or navigate back to the home ledger.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/">
            <Button variant="primary">
              Return to Ask
            </Button>
          </Link>
          <Link href="/tasks">
            <Button variant="secondary">
              View Active Tasks
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
