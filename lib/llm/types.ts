import type { Blueprint } from "@/lib/db/schemas";

export interface ExtractedCellValue {
  value: unknown;
  evidence: string;
  confidence: number;
}

export type ExtractedRow = Record<string, ExtractedCellValue>;

export interface DiscoverLimits {
  maxSources?: number;
}

export interface DiscoverResult {
  summary: string;
  urls: Array<{ url: string; title: string }>;
}

export interface ExtractParams {
  blueprint: Blueprint;
  sourceId: string;
  url: string;
  text: string;
}

export interface LlmClient {
  planBlueprint(prompt: string): Promise<Blueprint>;
  discover(query: string, limits?: DiscoverLimits): Promise<DiscoverResult>;
  extract(params: ExtractParams): Promise<ExtractedRow[]>;
}

export interface PlannerRefusal {
  refused: true;
  reason: string;
}

export class LlmError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(
    message: string,
    options?: { code?: string; status?: number; cause?: unknown }
  ) {
    super(message);
    this.name = "LlmError";
    this.code = options?.code ?? "LLM_ERROR";
    this.status = options?.status;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export class TokenBudgetExceededError extends LlmError {
  constructor(message = "Per-run token budget exceeded") {
    super(message, { code: "TOKEN_BUDGET_EXCEEDED" });
    this.name = "TokenBudgetExceededError";
  }
}
