import React from "react";
import { TasksLedger } from "@/components/tasks/TasksLedger";

export default function TasksPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-6">
      <div className="border-b border-rule pb-3">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft block mb-1">
          Field Ledger
        </span>
        <h1 className="font-display text-2xl md:text-3xl text-ink font-medium">
          Collection Tasks
        </h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1">
          Workflows and execution history scoped to this workspace.
        </p>
      </div>

      <TasksLedger />
    </main>
  );
}
