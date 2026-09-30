import { z } from "zod";

// Blueprint schemas
export const blueprintFieldTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "url",
  "email",
  "boolean",
]);

export type BlueprintFieldType = z.infer<typeof blueprintFieldTypeSchema>;

export const blueprintFieldSchema = z.object({
  key: z.string().min(1, "Field key is required"),
  label: z.string().min(1, "Field label is required"),
  type: blueprintFieldTypeSchema,
  required: z.boolean().default(false),
  description: z.string().default(""),
});

export type BlueprintField = z.infer<typeof blueprintFieldSchema>;

export const blueprintSourceKindSchema = z.enum(["search", "url"]);
export type BlueprintSourceKind = z.infer<typeof blueprintSourceKindSchema>;

export const blueprintSourceSchema = z.object({
  kind: blueprintSourceKindSchema,
  query: z.string().optional(),
  url: z.string().optional(),
});

export type BlueprintSource = z.infer<typeof blueprintSourceSchema>;

export const blueprintLimitsSchema = z.object({
  maxSources: z.number().int().positive("maxSources must be positive"),
  maxRecords: z.number().int().positive("maxRecords must be positive"),
});

export type BlueprintLimits = z.infer<typeof blueprintLimitsSchema>;

export const blueprintSchema = z.object({
  intent: z.string().min(1, "Intent is required"),
  entity: z.string().min(1, "Entity name is required"),
  fields: z.array(blueprintFieldSchema).min(1, "At least one field is required"),
  keyFields: z.array(z.string()).min(1, "At least one keyField is required for dedupe"),
  sources: z.array(blueprintSourceSchema).min(1, "At least one source is required"),
  limits: blueprintLimitsSchema,
});

export type Blueprint = z.infer<typeof blueprintSchema>;

// Workflow Schema
export const workflowStatusSchema = z.enum([
  "draft",
  "ready",
  "running",
  "completed",
  "error",
  "archived",
]);
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const workflowSchema = z.object({
  _id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  title: z.string().min(1, "title is required"),
  prompt: z.string().min(1, "prompt is required"),
  blueprint: blueprintSchema,
  status: workflowStatusSchema.default("ready"),
  latestRunId: z.string().nullable().optional().default(null),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type Workflow = z.infer<typeof workflowSchema>;

// Run Schema
export const runStatusSchema = z.enum([
  "queued",
  "planning",
  "discovering",
  "fetching",
  "extracting",
  "validating",
  "deduping",
  "verifying",
  "complete",
  "failed",
  "cancelled",
  "paused",
]);

export type RunStatus = z.infer<typeof runStatusSchema>;

// Stages that represent active processing (subset of RunStatus)
export type RunStage =
  | "planning"
  | "discovering"
  | "fetching"
  | "extracting"
  | "validating"
  | "deduping"
  | "verifying"
  | "complete";

export const runCountsSchema = z.object({
  sourcesFound: z.number().int().nonnegative().default(0),
  sourcesFetched: z.number().int().nonnegative().default(0),
  valuesExtracted: z.number().int().nonnegative().default(0),
  valuesRejected: z.number().int().nonnegative().default(0),
  recordsKept: z.number().int().nonnegative().default(0),
  duplicatesMerged: z.number().int().nonnegative().default(0),
  verified: z.number().int().nonnegative().default(0),
  unverified: z.number().int().nonnegative().default(0),
});

export type RunCounts = z.infer<typeof runCountsSchema>;

export const runSchema = z.object({
  _id: z.string().optional(),
  workflowId: z.string().min(1, "workflowId is required"),
  workspaceId: z.string().min(1, "workspaceId is required"),
  status: runStatusSchema.default("queued"),
  stage: z.string().min(1, "stage is required"),
  cursor: z.record(z.string(), z.unknown()).default({}),
  counts: runCountsSchema.default({
    sourcesFound: 0,
    sourcesFetched: 0,
    valuesExtracted: 0,
    valuesRejected: 0,
    recordsKept: 0,
    duplicatesMerged: 0,
    verified: 0,
    unverified: 0,
  }),
  error: z.string().nullable().optional().default(null),
  startedAt: z.coerce.date().nullable().optional().default(null),
  finishedAt: z.coerce.date().nullable().optional().default(null),
  previousRunId: z.string().nullable().optional().default(null),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type Run = z.infer<typeof runSchema>;

// Source Schema
export const sourceStatusSchema = z.enum([
  "pending",
  "fetched",
  "failed",
  "blocked",
  "skipped",
]);

export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const sourceSnapshotSchema = z.object({
  publicId: z.string().min(1),
  url: z.string().url(),
});

export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;

export const sourceRobotsSchema = z.object({
  allowed: z.boolean(),
  checkedAt: z.coerce.date(),
});

export type SourceRobots = z.infer<typeof sourceRobotsSchema>;

export const sourceSchema = z.object({
  _id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  runId: z.string().min(1, "runId is required"),
  url: z.string().url("Valid URL required"),
  domain: z.string().min(1, "domain is required"),
  title: z.string().nullable().optional().default(null),
  discoveredVia: z.string().min(1, "discoveredVia is required"),
  robots: sourceRobotsSchema,
  httpStatus: z.number().int().nullable().optional().default(null),
  fetchedAt: z.coerce.date().nullable().optional().default(null),
  contentHash: z.string().nullable().optional().default(null),
  textLength: z.number().int().nullable().optional().default(null),
  snapshot: sourceSnapshotSchema.nullable().optional().default(null),
  status: sourceStatusSchema.default("pending"),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type Source = z.infer<typeof sourceSchema>;

// Record Schema and Receipts
export const receiptValidatorStatusSchema = z.enum([
  "verified",
  "unverified",
  "contradicted",
]);

export type ReceiptValidatorStatus = z.infer<typeof receiptValidatorStatusSchema>;

export const receiptValidatorSchema = z.object({
  status: receiptValidatorStatusSchema,
  notes: z.string().nullable().optional().default(null),
});

export type ReceiptValidator = z.infer<typeof receiptValidatorSchema>;

export const receiptSchema = z.object({
  sourceId: z.string().min(1, "sourceId is required"),
  evidence: z.string().min(1, "evidence is required"),
  confidence: z.number().min(0).max(1, "confidence must be between 0 and 1"),
  extractedAt: z.coerce.date(),
  validator: receiptValidatorSchema,
});

export type Receipt = z.infer<typeof receiptSchema>;

export const recordSchema = z.object({
  _id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  runId: z.string().min(1, "runId is required"),
  workflowId: z.string().min(1, "workflowId is required"),
  fingerprint: z.string().min(1, "fingerprint is required"),
  values: z.record(z.string(), z.unknown()),
  receipts: z.record(z.string(), receiptSchema).default({}),
  rowConfidence: z.number().min(0).max(1).default(0),
  flags: z.array(z.string()).default([]),
  mergedFrom: z.array(z.string()).default([]),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type RecordDoc = z.infer<typeof recordSchema>;

// RunEvent Schema
export const runEventLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type RunEventLevel = z.infer<typeof runEventLevelSchema>;

export const runEventSchema = z.object({
  _id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  runId: z.string().min(1, "runId is required"),
  ts: z.coerce.date().default(() => new Date()),
  level: runEventLevelSchema.default("info"),
  stage: z.string().min(1, "stage is required"),
  message: z.string().min(1, "message is required"),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type RunEvent = z.infer<typeof runEventSchema>;

// ExportFile Schema
export const exportFormatSchema = z.enum(["csv", "json", "xlsx"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportFileSchema = z.object({
  _id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  runId: z.string().min(1, "runId is required"),
  format: exportFormatSchema,
  url: z.string().url("Valid URL required"),
  rows: z.number().int().nonnegative(),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type ExportFile = z.infer<typeof exportFileSchema>;
