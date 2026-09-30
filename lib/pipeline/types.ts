import type { Db } from "mongodb";
import type {
  Run,
  Blueprint,
  Receipt,
} from "@/lib/db/schemas";
import type {
  RunsRepo,
  WorkflowsRepo,
  SourcesRepo,
  RecordsRepo,
  EventsRepo,
} from "@/lib/db/repos";
import type { LlmClient, ExtractedRow } from "@/lib/llm/types";
import type { SnapshotStore } from "@/lib/sources/snapshot";
import type { RobotsChecker } from "@/lib/sources/robots";
import type { DomainRateLimiter } from "@/lib/sources/rateLimit";

export interface EngineDependencies {
  db: Db;
  llmClient?: LlmClient;
  snapshotStore?: SnapshotStore;
  fetchFn?: typeof fetch;
  rateLimiter?: DomainRateLimiter;
  robotsChecker?: RobotsChecker;
  clock?: () => number;
  runsRepo?: RunsRepo;
  workflowsRepo?: WorkflowsRepo;
  sourcesRepo?: SourcesRepo;
  recordsRepo?: RecordsRepo;
  eventsRepo?: EventsRepo;
}

export interface AdvanceOptions {
  budgetMs?: number;
}

export interface CandidateRow {
  sourceId: string;
  url: string;
  row: ExtractedRow;
}

export interface ValidatedCandidate {
  sourceId: string;
  url: string;
  values: Record<string, unknown>;
  receipts: Record<string, Receipt>;
}

export interface DedupeGroup {
  fingerprint: string;
  keyTokens: Set<string>;
  primaryCandidate: ValidatedCandidate;
  mergedCandidates: ValidatedCandidate[];
  mergedFrom: string[];
}

export interface StageContext {
  run: Run & { id: string };
  workspaceId: string;
  blueprint: Blueprint;
  deps: EngineDependencies;
  runsRepo: RunsRepo;
  workflowsRepo: WorkflowsRepo;
  sourcesRepo: SourcesRepo;
  recordsRepo: RecordsRepo;
  eventsRepo: EventsRepo;
  snapshotStore: SnapshotStore;
  llmClient: LlmClient;
  startTime: number;
  budgetMs: number;
}
