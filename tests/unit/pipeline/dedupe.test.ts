import { describe, it, expect } from "vitest";
import {
  computeFingerprintAndTokens,
  computeTokenSetSimilarity,
  deduplicateCandidates,
  verifyAndBuildRecord,
} from "@/lib/pipeline/dedupe";
import type { Blueprint } from "@/lib/db/schemas";
import type { ValidatedCandidate, DedupeGroup } from "@/lib/pipeline/types";

describe("Pipeline Deduplication and Receipt Verification", () => {
  it("computes deterministic fingerprint and token sets", () => {
    const values1 = { company: "Acme Corp.", title: "Software Engineer" };
    const values2 = { company: "acme corp", title: "software   engineer!" };

    const res1 = computeFingerprintAndTokens(values1, ["company", "title"]);
    const res2 = computeFingerprintAndTokens(values2, ["company", "title"]);

    expect(res1.fingerprint).toBe(res2.fingerprint);
    expect(Array.from(res1.keyTokens).sort()).toEqual(Array.from(res2.keyTokens).sort());
  });

  it("calculates token set Jaccard similarity accurately", () => {
    const emptySet = new Set<string>();
    expect(computeTokenSetSimilarity(emptySet, emptySet)).toBe(1.0);

    const setA = new Set(["apple", "banana", "cherry"]);
    const setB = new Set(["apple", "banana", "date"]);

    // intersection: apple, banana (2)
    // union: apple, banana, cherry, date (4)
    // 2 / 4 = 0.5
    expect(computeTokenSetSimilarity(setA, setB)).toBe(0.5);

    const disjoint = new Set(["fig", "grape"]);
    expect(computeTokenSetSimilarity(setA, disjoint)).toBe(0);
  });

  it("merges near-duplicates using similarity above 0.9", () => {
    const baseTitle = "One Two Three Four Five Six Seven Eight Nine Ten";
    const cand1: ValidatedCandidate = {
      sourceId: "s1",
      url: "https://example.com/1",
      values: { title: baseTitle, company: "Meta" },
      receipts: {},
    };
    const cand2: ValidatedCandidate = {
      sourceId: "s2",
      url: "https://example.com/2",
      // 10 matching words plus 1 extra word: 10/11 = 0.909 > 0.9
      values: { title: `${baseTitle} Extra`, company: "Meta" },
      receipts: {},
    };

    const res = deduplicateCandidates([cand1, cand2], ["title", "company"]);
    expect(res.groups.length).toBe(1);
    expect(res.duplicatesMergedCount).toBe(1);
    expect(res.groups[0].mergedFrom).toEqual(["s1", "s2"]);
  });

  it("verifies single source with unverified missing fields", () => {
    const blueprint: Blueprint = {
      intent: "Test",
      entity: "Job",
      fields: [
        { key: "title", label: "Title", type: "string", required: true, description: "" },
        { key: "notes", label: "Notes", type: "string", required: false, description: "" },
      ],
      keyFields: ["title"],
      sources: [{ kind: "url", url: "https://example.com" }],
      limits: { maxSources: 5, maxRecords: 10 },
    };

    const group: DedupeGroup = {
      fingerprint: "fp123",
      keyTokens: new Set(["lead"]),
      primaryCandidate: {
        sourceId: "src_1",
        url: "https://example.com/job",
        values: { title: "Lead" },
        receipts: {
          title: {
            sourceId: "src_1",
            evidence: "Lead",
            confidence: 0.9,
            extractedAt: new Date(),
            validator: { status: "verified", notes: null },
          },
        },
      },
      mergedCandidates: [],
      mergedFrom: ["src_1"],
    };

    const verified = verifyAndBuildRecord(group, blueprint, "wf1", "run1", "ws1");
    expect(verified.verifiedFieldsCount).toBe(1);
    expect(verified.unverifiedFieldsCount).toBe(1);
    expect(verified.record.rowConfidence).toBe(0.9);
  });
});
