import type { Blueprint, BlueprintFieldType, Receipt } from "@/lib/db/schemas";
import { verifyEvidence } from "@/lib/sources/evidence";
import type { CandidateRow, ValidatedCandidate } from "./types";

export interface FieldValidationResult {
  valid: boolean;
  value?: unknown;
  reason?: string;
}

export function validateAndNormalizeField(
  rawVal: unknown,
  type: BlueprintFieldType,
  baseUrl: string
): FieldValidationResult {
  if (rawVal === null || rawVal === undefined) {
    return { valid: true, value: null };
  }

  switch (type) {
    case "string": {
      const str = String(rawVal).trim();
      return { valid: true, value: str.length > 0 ? str : null };
    }

    case "number": {
      if (typeof rawVal === "number" && !Number.isNaN(rawVal)) {
        return { valid: true, value: rawVal };
      }
      const str = String(rawVal)
        .replace(/[$€£₹,]/g, "")
        .trim();
      const num = Number(str);
      if (Number.isNaN(num)) {
        return { valid: false, reason: `Cannot parse number from '${rawVal}'` };
      }
      return { valid: true, value: num };
    }

    case "date": {
      if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
        return { valid: true, value: rawVal.toISOString() };
      }
      const parsed = new Date(String(rawVal));
      if (Number.isNaN(parsed.getTime())) {
        return { valid: false, reason: `Cannot parse date from '${rawVal}'` };
      }
      return { valid: true, value: parsed.toISOString() };
    }

    case "url": {
      const str = String(rawVal).trim();
      try {
        const resolved = new URL(str, baseUrl).href;
        return { valid: true, value: resolved };
      } catch {
        return { valid: false, reason: `Invalid URL '${rawVal}' relative to '${baseUrl}'` };
      }
    }

    case "email": {
      const str = String(rawVal).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(str)) {
        return { valid: false, reason: `Invalid email format '${rawVal}'` };
      }
      return { valid: true, value: str };
    }

    case "boolean": {
      if (typeof rawVal === "boolean") {
        return { valid: true, value: rawVal };
      }
      const str = String(rawVal).trim().toLowerCase();
      if (str === "true" || str === "yes" || str === "1") {
        return { valid: true, value: true };
      }
      if (str === "false" || str === "no" || str === "0") {
        return { valid: true, value: false };
      }
      return { valid: false, reason: `Cannot parse boolean from '${rawVal}'` };
    }

    default:
      return { valid: true, value: rawVal };
  }
}

export interface CandidateValidationOutcome {
  accepted: boolean;
  dropReason?: string;
  validatedCandidate?: ValidatedCandidate;
  valuesRejectedCount: number;
  rejectionReasons: string[];
}

export async function validateCandidate(
  candidate: CandidateRow,
  blueprint: Blueprint,
  getSnapshotText: (sourceId: string) => Promise<string | null>
): Promise<CandidateValidationOutcome> {
  const snapshotText = await getSnapshotText(candidate.sourceId);
  const validatedValues: Record<string, unknown> = {};
  const receipts: Record<string, Receipt> = {};
  let valuesRejectedCount = 0;
  const rejectionReasons: string[] = [];

  for (const field of blueprint.fields) {
    const cell = candidate.row[field.key];
    if (!cell || cell.value === undefined || cell.value === null) {
      continue;
    }

    // (a) Evidence gate: verify that evidence quote appears verbatim in snapshot
    if (!snapshotText) {
      valuesRejectedCount++;
      rejectionReasons.push(`Snapshot missing for source ${candidate.sourceId}`);
      continue;
    }

    const evidencePasses = verifyEvidence(snapshotText, cell.evidence);
    if (!evidencePasses) {
      valuesRejectedCount++;
      rejectionReasons.push(
        `Evidence gate failed for field '${field.key}': quote not in snapshot`
      );
      continue;
    }

    // (b) Type validation and normalisation
    const typeResult = validateAndNormalizeField(cell.value, field.type, candidate.url);
    if (!typeResult.valid) {
      valuesRejectedCount++;
      rejectionReasons.push(
        `Type validation failed for field '${field.key}': ${typeResult.reason}`
      );
      continue;
    }

    if (typeResult.value !== null && typeResult.value !== undefined) {
      validatedValues[field.key] = typeResult.value;
      receipts[field.key] = {
        sourceId: candidate.sourceId,
        evidence: cell.evidence,
        confidence: Math.max(0, Math.min(1, cell.confidence ?? 0.8)),
        extractedAt: new Date(),
        validator: {
          status: "verified",
          notes: null,
        },
      };
    }
  }

  // (c) Required-field check: drop record if any required field is missing
  for (const field of blueprint.fields) {
    if (field.required) {
      const val = validatedValues[field.key];
      if (val === undefined || val === null || val === "") {
        return {
          accepted: false,
          dropReason: `Missing required field '${field.key}'`,
          valuesRejectedCount,
          rejectionReasons,
        };
      }
    }
  }

  return {
    accepted: true,
    validatedCandidate: {
      sourceId: candidate.sourceId,
      url: candidate.url,
      values: validatedValues,
      receipts,
    },
    valuesRejectedCount,
    rejectionReasons,
  };
}
