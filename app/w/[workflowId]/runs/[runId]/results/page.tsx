import React from "react";
import { ResultsDashboard } from "@/components/results/ResultsDashboard";

interface ResultsPageProps {
  params: Promise<{
    workflowId: string;
    runId: string;
  }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { workflowId, runId } = await params;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10">
      <ResultsDashboard workflowId={workflowId} runId={runId} />
    </main>
  );
}
