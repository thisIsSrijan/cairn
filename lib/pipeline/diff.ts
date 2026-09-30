import type { RecordDoc, Run } from "@/lib/db/schemas";

export interface FieldChange {
  previous: unknown;
  current: unknown;
}

export interface ChangedRecord {
  current: RecordDoc & { id: string };
  previous: RecordDoc & { id: string };
  changes: Record<string, FieldChange>;
}

export interface RunDiffResult {
  runId: string;
  previousRunId: string | null;
  summary: {
    added: number;
    removed: number;
    changed: number;
  };
  added: Array<RecordDoc & { id: string }>;
  removed: Array<RecordDoc & { id: string }>;
  changed: ChangedRecord[];
}

export function computeRunDiff(
  run: Run & { id: string },
  currentRecords: Array<RecordDoc & { id: string }>,
  previousRecords: Array<RecordDoc & { id: string }>
): RunDiffResult {
  const previousRunId = run.previousRunId || null;

  if (!previousRunId || previousRecords.length === 0) {
    return {
      runId: run.id,
      previousRunId,
      summary: {
        added: currentRecords.length,
        removed: 0,
        changed: 0,
      },
      added: currentRecords,
      removed: [],
      changed: [],
    };
  }

  const prevByFingerprint = new Map<string, RecordDoc & { id: string }>();
  for (const prev of previousRecords) {
    prevByFingerprint.set(prev.fingerprint, prev);
  }

  const currByFingerprint = new Map<string, RecordDoc & { id: string }>();
  for (const curr of currentRecords) {
    currByFingerprint.set(curr.fingerprint, curr);
  }

  const added: Array<RecordDoc & { id: string }> = [];
  const changed: ChangedRecord[] = [];

  for (const curr of currentRecords) {
    const prev = prevByFingerprint.get(curr.fingerprint);
    if (!prev) {
      added.push(curr);
      continue;
    }

    // Compare fields between previous and current
    const prevValues = prev.values || {};
    const currValues = curr.values || {};
    const allKeys = new Set([...Object.keys(prevValues), ...Object.keys(currValues)]);
    const fieldChanges: Record<string, FieldChange> = {};

    for (const key of allKeys) {
      const prevVal = prevValues[key];
      const currVal = currValues[key];
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        fieldChanges[key] = {
          previous: prevVal ?? null,
          current: currVal ?? null,
        };
      }
    }

    if (Object.keys(fieldChanges).length > 0) {
      changed.push({
        current: curr,
        previous: prev,
        changes: fieldChanges,
      });
    }
  }

  const removed: Array<RecordDoc & { id: string }> = [];
  for (const prev of previousRecords) {
    if (!currByFingerprint.has(prev.fingerprint)) {
      removed.push(prev);
    }
  }

  return {
    runId: run.id,
    previousRunId,
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
    },
    added,
    removed,
    changed,
  };
}
