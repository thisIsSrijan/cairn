import React from "react";
import { LiveRunView } from "@/components/run/LiveRunView";

interface RunPageProps {
  params: Promise<{
    workflowId: string;
    runId: string;
  }>;
}

export default async function RunExecutionPage({ params }: RunPageProps) {
  const { workflowId, runId } = await params;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10">
      <LiveRunView workflowId={workflowId} runId={runId} />
    </main>
  );
}
