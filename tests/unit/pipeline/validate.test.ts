import { describe, it, expect } from "vitest";
import {
  validateAndNormalizeField,
  validateCandidate,
} from "@/lib/pipeline/validate";
import type { Blueprint } from "@/lib/db/schemas";
import type { CandidateRow } from "@/lib/pipeline/types";

describe("Pipeline Field Validation and Normalisation", () => {
  it("normalises and validates string fields", () => {
    expect(validateAndNormalizeField(null, "string", "https://example.com")).toEqual({
      valid: true,
      value: null,
    });
    expect(validateAndNormalizeField(undefined, "string", "https://example.com")).toEqual({
      valid: true,
      value: null,
    });
    expect(validateAndNormalizeField("   Software Engineer  ", "string", "https://example.com")).toEqual({
      valid: true,
      value: "Software Engineer",
    });
    expect(validateAndNormalizeField("   ", "string", "https://example.com")).toEqual({
      valid: true,
      value: null,
    });
  });

  it("normalises and validates number fields", () => {
    expect(validateAndNormalizeField(42, "number", "https://example.com")).toEqual({
      valid: true,
      value: 42,
    });
    expect(validateAndNormalizeField("$120,000", "number", "https://example.com")).toEqual({
      valid: true,
      value: 120000,
    });
    expect(validateAndNormalizeField("€4,500.50", "number", "https://example.com")).toEqual({
      valid: true,
      value: 4500.5,
    });
    expect(validateAndNormalizeField("not-a-number", "number", "https://example.com")).toEqual({
      valid: false,
      reason: "Cannot parse number from 'not-a-number'",
    });
  });

  it("normalises and validates date fields", () => {
    const now = new Date("2026-03-30T10:00:00.000Z");
    expect(validateAndNormalizeField(now, "date", "https://example.com")).toEqual({
      valid: true,
      value: now.toISOString(),
    });
    expect(validateAndNormalizeField("2026-03-30", "date", "https://example.com")).toEqual({
      valid: true,
      value: new Date("2026-03-30").toISOString(),
    });
    expect(validateAndNormalizeField("invalid-date", "date", "https://example.com")).toEqual({
      valid: false,
      reason: "Cannot parse date from 'invalid-date'",
    });
  });

  it("normalises and validates url fields", () => {
    expect(validateAndNormalizeField("/jobs/123", "url", "https://example.com/careers/")).toEqual({
      valid: true,
      value: "https://example.com/jobs/123",
    });
    expect(validateAndNormalizeField("https://cdn.example.com/image.png", "url", "https://example.com")).toEqual({
      valid: true,
      value: "https://cdn.example.com/image.png",
    });
    expect(validateAndNormalizeField("http://[invalid-url", "url", "https://example.com")).toEqual({
      valid: false,
      reason: "Invalid URL 'http://[invalid-url' relative to 'https://example.com'",
    });
  });

  it("normalises and validates email fields", () => {
    expect(validateAndNormalizeField("User.Name@Example.COM ", "email", "https://example.com")).toEqual({
      valid: true,
      value: "user.name@example.com",
    });
    expect(validateAndNormalizeField("not-an-email", "email", "https://example.com")).toEqual({
      valid: false,
      reason: "Invalid email format 'not-an-email'",
    });
  });

  it("normalises and validates boolean fields", () => {
    expect(validateAndNormalizeField(true, "boolean", "https://example.com")).toEqual({
      valid: true,
      value: true,
    });
    expect(validateAndNormalizeField(false, "boolean", "https://example.com")).toEqual({
      valid: true,
      value: false,
    });
    expect(validateAndNormalizeField("true", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: true,
    });
    expect(validateAndNormalizeField("yes", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: true,
    });
    expect(validateAndNormalizeField("1", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: true,
    });
    expect(validateAndNormalizeField("false", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: false,
    });
    expect(validateAndNormalizeField("no", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: false,
    });
    expect(validateAndNormalizeField("0", "boolean", "https://example.com")).toEqual({
      valid: true,
      value: false,
    });
    expect(validateAndNormalizeField("maybe", "boolean", "https://example.com")).toEqual({
      valid: false,
      reason: "Cannot parse boolean from 'maybe'",
    });
  });

  it("handles unknown field types with pass-through", () => {
    expect(
      validateAndNormalizeField(
        "raw",
        "custom" as unknown as Parameters<typeof validateAndNormalizeField>[1],
        "https://example.com"
      )
    ).toEqual({
      valid: true,
      value: "raw",
    });
  });

  it("drops candidate row if required field is missing", async () => {
    const blueprint: Blueprint = {
      intent: "Test",
      entity: "Job",
      fields: [
        { key: "title", label: "Title", type: "string", required: true, description: "" },
        { key: "company", label: "Company", type: "string", required: true, description: "" },
      ],
      keyFields: ["title"],
      sources: [{ kind: "url", url: "https://example.com" }],
      limits: { maxSources: 5, maxRecords: 10 },
    };

    const candidate: CandidateRow = {
      sourceId: "src_1",
      url: "https://example.com/job",
      row: {
        title: { value: "Lead Engineer", evidence: "Lead Engineer", confidence: 0.9 },
        // company is missing!
      },
    };

    const outcome = await validateCandidate(candidate, blueprint, async () => "Lead Engineer at Startup");
    expect(outcome.accepted).toBe(false);
    expect(outcome.dropReason).toBe("Missing required field 'company'");
  });

  it("rejects values if snapshot is not found", async () => {
    const blueprint: Blueprint = {
      intent: "Test",
      entity: "Job",
      fields: [
        { key: "title", label: "Title", type: "string", required: true, description: "" },
      ],
      keyFields: ["title"],
      sources: [{ kind: "url", url: "https://example.com" }],
      limits: { maxSources: 5, maxRecords: 10 },
    };

    const candidate: CandidateRow = {
      sourceId: "src_1",
      url: "https://example.com/job",
      row: {
        title: { value: "Engineer", evidence: "Engineer", confidence: 0.9 },
      },
    };

    const outcome = await validateCandidate(candidate, blueprint, async () => null);
    expect(outcome.accepted).toBe(false);
    expect(outcome.valuesRejectedCount).toBe(1);
  });
});
