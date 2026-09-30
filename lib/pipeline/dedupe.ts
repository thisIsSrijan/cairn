import crypto from "crypto";
import type { Blueprint, Receipt, RecordDoc } from "@/lib/db/schemas";
import type { ValidatedCandidate, DedupeGroup } from "./types";

/**
 * Normalises key fields to generate exact fingerprint and token sets for near-duplicate matching.
 */
export function computeFingerprintAndTokens(
  values: Record<string, unknown>,
  keyFields: string[]
): { fingerprint: string; keyTokens: Set<string>; normalizedString: string } {
  const parts: string[] = [];

  for (const key of keyFields) {
    const rawVal = values[key];
    const str = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
    const clean = str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");
    parts.push(clean);
  }

  const normalizedString = parts.join(" | ");
  const fingerprint = crypto
    .createHash("sha256")
    .update(normalizedString, "utf-8")
    .digest("hex");

  const words = normalizedString
    .split(/\s+/)
    .filter((w) => w.length > 0 && w !== "|");
  const keyTokens = new Set<string>(words);

  return { fingerprint, keyTokens, normalizedString };
}

/**
 * Calculates token-set Jaccard similarity between two sets of tokens.
 */
export function computeTokenSetSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 1.0 : intersectionCount / unionCount;
}

export interface DeduplicationResult {
  groups: DedupeGroup[];
  duplicatesMergedCount: number;
}

/**
 * Groups candidate records by exact fingerprint or token-set similarity > 0.9.
 */
export function deduplicateCandidates(
  candidates: ValidatedCandidate[],
  keyFields: string[]
): DeduplicationResult {
  const groups: DedupeGroup[] = [];
  let duplicatesMergedCount = 0;

  for (const candidate of candidates) {
    const { fingerprint, keyTokens } = computeFingerprintAndTokens(
      candidate.values,
      keyFields
    );

    // 1. Check exact fingerprint match
    const exactGroup = groups.find((g) => g.fingerprint === fingerprint);
    if (exactGroup) {
      exactGroup.mergedCandidates.push(candidate);
      if (!exactGroup.mergedFrom.includes(candidate.sourceId)) {
        exactGroup.mergedFrom.push(candidate.sourceId);
      }
      duplicatesMergedCount++;
      continue;
    }

    // 2. Check near-duplicate match using token-set similarity > 0.9
    let bestGroup: DedupeGroup | null = null;
    let bestSimilarity = 0.9; // strictly greater than 0.9 threshold

    for (const group of groups) {
      const similarity = computeTokenSetSimilarity(keyTokens, group.keyTokens);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.mergedCandidates.push(candidate);
      if (!bestGroup.mergedFrom.includes(candidate.sourceId)) {
        bestGroup.mergedFrom.push(candidate.sourceId);
      }
      duplicatesMergedCount++;
      continue;
    }

    // 3. New unique group
    groups.push({
      fingerprint,
      keyTokens,
      primaryCandidate: candidate,
      mergedCandidates: [],
      mergedFrom: [candidate.sourceId],
    });
  }

  return { groups, duplicatesMergedCount };
}

function normalizeForComparison(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val);
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export interface VerifiedRecordResult {
  record: Omit<RecordDoc, "_id" | "createdAt">;
  verifiedFieldsCount: number;
  unverifiedFieldsCount: number;
}

/**
 * Verifies fields for a deduplicated group:
 * - If 2 sources agree: status verified, confidence boosted, multiple receipts kept
 * - If 2 sources disagree: status contradicted, flagged, both receipts kept
 * - Single source passing evidence: status verified
 * - Otherwise: unverified
 * Computes rowConfidence.
 */
export function verifyAndBuildRecord(
  group: DedupeGroup,
  blueprint: Blueprint,
  workflowId: string,
  runId: string,
  workspaceId: string
): VerifiedRecordResult {
  const allCandidates = [group.primaryCandidate, ...group.mergedCandidates];
  const mergedValues: Record<string, unknown> = {};
  const mergedReceipts: Record<string, Receipt> = {};
  const flags: string[] = [];

  let verifiedFieldsCount = 0;
  let unverifiedFieldsCount = 0;
  const fieldConfidences: number[] = [];

  for (const field of blueprint.fields) {
    const key = field.key;
    const cellsWithVal: Array<{
      value: unknown;
      receipt: Receipt;
      candidate: ValidatedCandidate;
    }> = [];

    for (const cand of allCandidates) {
      if (cand.values[key] !== undefined && cand.values[key] !== null) {
        const rcpt = cand.receipts[key];
        if (rcpt) {
          cellsWithVal.push({
            value: cand.values[key],
            receipt: rcpt,
            candidate: cand,
          });
        }
      }
    }

    if (cellsWithVal.length === 0) {
      unverifiedFieldsCount++;
      continue;
    }

    if (cellsWithVal.length === 1) {
      // Single source
      const single = cellsWithVal[0];
      mergedValues[key] = single.value;
      mergedReceipts[key] = {
        ...single.receipt,
        validator: {
          status: "verified",
          notes: null,
        },
      };
      fieldConfidences.push(single.receipt.confidence);
      verifiedFieldsCount++;
    } else {
      // 2 or more sources provide values
      const firstNorm = normalizeForComparison(cellsWithVal[0].value);
      const allAgree = cellsWithVal.every(
        (c) => normalizeForComparison(c.value) === firstNorm
      );

      if (allAgree) {
        // Sources agree: boost confidence
        const confs = cellsWithVal.map((c) => c.receipt.confidence);
        const maxConf = Math.max(...confs);
        const boosted = Math.min(1.0, Number((maxConf + 0.12).toFixed(2)));

        mergedValues[key] = cellsWithVal[0].value;
        mergedReceipts[key] = {
          ...cellsWithVal[0].receipt,
          confidence: boosted,
          validator: {
            status: "verified",
            notes: `Verified across ${cellsWithVal.length} agreeing sources`,
          },
        };

        // Keep additional receipts under suffixed keys
        for (let i = 1; i < cellsWithVal.length; i++) {
          const altKey = `${key}__${cellsWithVal[i].candidate.sourceId}`;
          mergedReceipts[altKey] = {
            ...cellsWithVal[i].receipt,
            validator: {
              status: "verified",
              notes: `Corroborating receipt from ${cellsWithVal[i].candidate.url}`,
            },
          };
        }

        fieldConfidences.push(boosted);
        verifiedFieldsCount++;
      } else {
        // Contradiction detected
        flags.push(`contradiction:${key}`);

        mergedValues[key] = cellsWithVal[0].value;
        mergedReceipts[key] = {
          ...cellsWithVal[0].receipt,
          validator: {
            status: "contradicted",
            notes: `Contradicted by source ${cellsWithVal[1].candidate.sourceId}: '${String(cellsWithVal[0].value)}' vs '${String(cellsWithVal[1].value)}'`,
          },
        };

        // Keep conflicting receipt
        const conflictKey = `${key}__conflict_${cellsWithVal[1].candidate.sourceId}`;
        mergedReceipts[conflictKey] = {
          ...cellsWithVal[1].receipt,
          validator: {
            status: "contradicted",
            notes: `Contradicting value '${String(cellsWithVal[1].value)}'`,
          },
        };

        const avgConf = Number(
          (
            cellsWithVal.reduce((acc, c) => acc + c.receipt.confidence, 0) /
            cellsWithVal.length
          ).toFixed(2)
        );
        fieldConfidences.push(avgConf);
        unverifiedFieldsCount++;
      }
    }
  }

  const rowConfidence =
    fieldConfidences.length > 0
      ? Number(
          (
            fieldConfidences.reduce((a, b) => a + b, 0) /
            fieldConfidences.length
          ).toFixed(2)
        )
      : 0;

  return {
    record: {
      workspaceId,
      runId,
      workflowId,
      fingerprint: group.fingerprint,
      values: mergedValues,
      receipts: mergedReceipts,
      rowConfidence,
      flags,
      mergedFrom: group.mergedFrom,
    },
    verifiedFieldsCount,
    unverifiedFieldsCount,
  };
}
