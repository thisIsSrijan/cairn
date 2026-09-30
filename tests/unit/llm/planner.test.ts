import { describe, it, expect } from "vitest";
import { planUserPrompt, validateAndClampBlueprint, isPlannerRefusal } from "@/lib/llm/planner";
import { FakeLlmClient } from "@/lib/llm/fake";
import type { LlmClient } from "@/lib/llm/types";
import { LlmError } from "@/lib/llm/types";

describe("Blueprint Planner", () => {
  const fakeClient = new FakeLlmClient();

  it("plans blueprint for junior developers in Lucknow", async () => {
    const result = await planUserPrompt("job openings for junior developers in Lucknow", fakeClient);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blueprint.entity).toBe("JobOpening");
    expect(result.blueprint.fields.length).toBeGreaterThanOrEqual(3);
    expect(result.blueprint.fields.length).toBeLessThanOrEqual(12);
    expect(result.blueprint.keyFields.length).toBeGreaterThanOrEqual(1);
    expect(result.blueprint.limits.maxSources).toBeLessThanOrEqual(12);
    expect(result.blueprint.limits.maxRecords).toBeLessThanOrEqual(100);
  });

  it("plans blueprint for college tech fest sponsors", async () => {
    const result = await planUserPrompt("sponsorship opportunities for a college tech fest", fakeClient);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blueprint.entity).toBe("SponsorOpportunity");
    expect(result.blueprint.keyFields).toContain("company_name");
  });

  it("plans blueprint for noise-cancelling headphones pricing", async () => {
    const result = await planUserPrompt("pricing of noise-cancelling headphones", fakeClient);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blueprint.entity).toBe("HeadphoneModel");
    expect(result.blueprint.keyFields).toContain("model_name");
  });

  describe("Guards and validation", () => {
    it("converts and normalises field keys to snake_case", () => {
      const raw = {
        intent: "Test intent",
        entity: "Item",
        fields: [
          { key: "CompanyName", label: "Company", type: "string" },
          { key: "contact-email", label: "Email", type: "email" },
          { key: "annual_revenue", label: "Revenue", type: "number" },
        ],
        keyFields: ["CompanyName"],
        sources: [{ kind: "search", query: "companies" }],
        limits: { maxSources: 5, maxRecords: 20 },
      };

      const clamped = validateAndClampBlueprint(raw);
      expect(clamped.fields[0].key).toBe("company_name");
      expect(clamped.fields[1].key).toBe("contact_email");
      expect(clamped.fields[2].key).toBe("annual_revenue");
      expect(clamped.keyFields).toEqual(["company_name"]);
    });

    it("clamps limits to maximum 12 sources and 100 records", () => {
      const raw = {
        intent: "Test limits",
        entity: "Item",
        fields: [
          { key: "f_one", label: "One", type: "string" },
          { key: "f_two", label: "Two", type: "string" },
          { key: "f_three", label: "Three", type: "string" },
        ],
        keyFields: ["f_one"],
        sources: [{ kind: "search", query: "query" }],
        limits: { maxSources: 50, maxRecords: 1000 },
      };

      const clamped = validateAndClampBlueprint(raw);
      expect(clamped.limits.maxSources).toBe(12);
      expect(clamped.limits.maxRecords).toBe(100);
    });

    it("enforces minimum 3 fields and clamps to maximum 12 fields", () => {
      const tooFew = {
        intent: "Too few fields",
        entity: "Item",
        fields: [
          { key: "f_one", label: "One", type: "string" },
          { key: "f_two", label: "Two", type: "string" },
        ],
        keyFields: ["f_one"],
        sources: [{ kind: "search", query: "query" }],
        limits: { maxSources: 5, maxRecords: 10 },
      };

      expect(() => validateAndClampBlueprint(tooFew)).toThrow(/between 3 and 12 fields/i);

      const manyFields = Array.from({ length: 15 }, (_, i) => ({
        key: `field_${i + 1}`,
        label: `Field ${i + 1}`,
        type: "string",
      }));

      const clamped = validateAndClampBlueprint({
        intent: "Many fields",
        entity: "Item",
        fields: manyFields,
        keyFields: ["field_1"],
        sources: [{ kind: "search", query: "query" }],
        limits: { maxSources: 5, maxRecords: 10 },
      });

      expect(clamped.fields.length).toBe(12);
    });

    it("ensures at least one keyField is always present and valid", () => {
      const noKeyField = {
        intent: "Missing keyField",
        entity: "Item",
        fields: [
          { key: "title", label: "Title", type: "string" },
          { key: "subtitle", label: "Subtitle", type: "string" },
          { key: "url", label: "URL", type: "url" },
        ],
        keyFields: [],
        sources: [{ kind: "search", query: "query" }],
        limits: { maxSources: 5, maxRecords: 10 },
      };

      const clamped = validateAndClampBlueprint(noKeyField);
      expect(clamped.keyFields.length).toBeGreaterThanOrEqual(1);
      expect(clamped.keyFields[0]).toBe("title");
    });
  });

  describe("Refusal path for private personal data", () => {
    it("refuses prompts requesting private personal contact info of individuals", async () => {
      const prompts = [
        "Find personal phone numbers and home addresses of employees at Company X",
        "Give me private cell numbers and home addresses of private citizens in Delhi",
        "Personal contact info, private WhatsApp numbers and personal emails of private individuals",
      ];

      for (const prompt of prompts) {
        const result = await planUserPrompt(prompt, fakeClient);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(isPlannerRefusal(result.refusal)).toBe(true);
          expect(result.refusal.refused).toBe(true);
          expect(result.refusal.reason).toMatch(/personal|private/i);
        }
      }
    });
  });

  describe("Invalid model output handling", () => {
    it("throws typed LlmError when client fails or returns unparseable output", async () => {
      const brokenClient: LlmClient = {
        planBlueprint: async () => {
          throw new LlmError("Invalid JSON from model after repair", { code: "INVALID_JSON" });
        },
        discover: async () => ({ summary: "", urls: [] }),
        extract: async () => [],
      };

      await expect(
        planUserPrompt("job openings for junior developers in Lucknow", brokenClient)
      ).rejects.toThrow(LlmError);
    });
  });
});
