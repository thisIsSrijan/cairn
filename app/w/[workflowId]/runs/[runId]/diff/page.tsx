import React from "react";
import { DiffPageClient } from "@/components/diff/DiffPageClient";

interface DiffPageProps {
  params: Promise<{
    workflowId: string;
    runId: string;
  }>;
}

export default async function DiffPage({ params }: DiffPageProps) {
  const { workflowId, runId } = await params;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10">
      <DiffPageClient workflowId={workflowId} runId={runId} />
    </main>
  );
}
