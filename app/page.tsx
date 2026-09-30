"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ContourArt } from "@/components/art/ContourArt";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { BlueprintReview } from "@/components/blueprint/BlueprintReview";
import type { Blueprint } from "@/lib/db/schemas";
import type { PlannerRefusal } from "@/lib/llm/planner";

const EXAMPLE_REQUESTS = [
  {
    label: "Junior developer jobs in Lucknow",
    prompt: "Job openings for junior developers in Lucknow",
  },
  {
    label: "College tech fest sponsors",
    prompt: "Sponsorship opportunities for a college tech fest",
  },
  {
    label: "Noise-cancelling headphones",
    prompt: "Pricing of noise-cancelling headphones",
  },
];

export default function AskPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [refusal, setRefusal] = useState<PlannerRefusal | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const handleSubmitPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isPlanning) return;

    setIsPlanning(true);
    setPlanningError(null);
    setRefusal(null);
    setBlueprint(null);
    setIsReviewOpen(true);

    try {
      const res = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to formulate collection blueprint");
      }

      if (data.refusal) {
        setRefusal(data.refusal);
      } else {
        setBlueprint(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setPlanningError(msg);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleStartCollecting = async (finalBlueprint: Blueprint) => {
    if (isStarting) return;
    setIsStarting(true);
    setPlanningError(null);

    try {
      // 1. Create Workflow
      const wfRes = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          blueprint: finalBlueprint,
        }),
      });

      const wfData = await wfRes.json();
      if (!wfRes.ok) {
        throw new Error(wfData.error?.message || "Failed to create workflow");
      }

      const workflowId = wfData.id || wfData._id;

      // 2. Create Run
      const runRes = await fetch(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limits: finalBlueprint.limits,
        }),
      });

      const runData = await runRes.json();
      if (!runRes.ok) {
        throw new Error(runData.error?.message || "Failed to initialize collection run");
      }

      const runId = runData.id || runData._id;

      // 3. Navigate to Run execution view
      router.push(`/w/${workflowId}/runs/${runId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to launch collection task";
      setPlanningError(msg);
      setIsStarting(false);
    }
  };

  return (
    <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 md:pt-14 space-y-8">
      {/* Hero section with oversized Fraunces headline and deterministic contour SVG behind */}
      <section className="relative overflow-hidden pt-2 pb-4">
        {/* Topographic contour illustration behind headline */}
        <div className="absolute inset-0 -z-10 pointer-events-none opacity-85 select-none overflow-hidden">
          <ContourArt
            seed={42}
            width={900}
            height={380}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink font-semibold">
              FIELD LEDGER
            </span>
            <span className="h-1 w-1 rounded-full bg-rule" aria-hidden="true" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              EVIDENCE VERIFIED
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-ink font-normal leading-[1.08] tracking-tight">
            <span className="sr-only">Cairn. </span>
            Ask in plain English.
            <span className="block text-ink-soft">
              Get a dataset you can defend.
            </span>
          </h1>

          <p className="text-sm md:text-base text-ink-soft max-w-xl leading-relaxed pt-1">
            Every cell carries its receipt: source URL, exact verbatim quote, timestamp, and validator verdict. No silent guesses.
          </p>
        </div>
      </section>

      {/* Request Composer */}
      <section className="max-w-2xl space-y-3">
        <form onSubmit={handleSubmitPrompt} className="space-y-3">
          <div className="bg-paper-2/60 border border-rule rounded-xs p-3.5 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="composer-request-input"
                className="font-mono text-xs uppercase tracking-wider text-ink-soft font-semibold select-none"
              >
                REQUEST
              </label>
              <span className="font-mono text-[11px] text-ink-soft">
                {prompt.length} / 1000
              </span>
            </div>

            <textarea
              id="composer-request-input"
              aria-label="REQUEST"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the entity, specific fields, and web sources to target (e.g. junior developer jobs in Lucknow with company, salary, and requirements)..."
              maxLength={1000}
              rows={3}
              className="w-full bg-paper px-3 py-2.5 text-sm md:text-base text-ink border border-rule rounded-xs focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal placeholder:text-ink-soft/45 resize-y transition-colors min-h-[96px]"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-ink-soft/80 hidden sm:inline-block">
                Press Generate to formulate schema and target sources
              </span>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!prompt.trim() || isPlanning}
                loading={isPlanning}
                className="w-full sm:w-auto ml-auto"
              >
                Generate blueprint
              </Button>
            </div>
          </div>
        </form>

        {/* Quiet example request chips */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft select-none">
            <span>Example queries</span>
          </div>

          <div
            tabIndex={0}
            aria-label="Example queries strip"
            className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar focus-visible:outline-1 focus-visible:outline-signal rounded-xs"
          >
            {EXAMPLE_REQUESTS.map((item) => (
              <Chip
                key={item.label}
                label={item.label}
                onClick={() => setPrompt(item.prompt)}
                className="shrink-0"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Blueprint Review Panel / Sheet */}
      <BlueprintReview
        open={isReviewOpen}
        loading={isPlanning}
        blueprint={blueprint}
        refusal={refusal}
        error={planningError}
        onClose={() => setIsReviewOpen(false)}
        onStart={handleStartCollecting}
        starting={isStarting}
      />
    </main>
  );
}
