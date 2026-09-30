import React from "react";
import { WorkflowDetailPageClient } from "@/components/workflow/WorkflowDetailPageClient";

interface WorkflowDetailPageProps {
  params: Promise<{ workflowId: string }>;
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { workflowId } = await params;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10">
      <WorkflowDetailPageClient id={workflowId} />
    </main>
  );
}
