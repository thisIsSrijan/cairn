import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DatasetsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="border-b border-rule pb-4 mb-6">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
          Ledger
        </span>
        <h1 className="font-display text-2xl md:text-3xl text-ink font-medium">
          Verified Datasets
        </h1>
      </div>

      <div className="p-8 border border-rule border-dashed rounded-xs text-center space-y-4 bg-paper-2/40">
        <p className="text-sm text-ink-soft">
          No datasets collected yet. Every verified row carries receipt evidence.
        </p>
        <Link href="/">
          <Button variant="secondary" size="sm">
            Plan your first dataset
          </Button>
        </Link>
      </div>
    </main>
  );
}
