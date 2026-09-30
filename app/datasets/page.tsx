import React from "react";
import { DatasetsLedger } from "@/components/datasets/DatasetsLedger";

export default function DatasetsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
      <div className="border-b border-rule pb-4">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft block font-semibold">
          Ledger
        </span>
        <h1 className="font-display text-2xl md:text-3xl text-ink font-medium tracking-tight">
          Verified Datasets
        </h1>
      </div>

      <DatasetsLedger />
    </main>
  );
}
