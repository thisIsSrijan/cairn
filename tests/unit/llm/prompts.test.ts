import { describe, it, expect } from "vitest";
import {
  buildPlannerPrompt,
  buildDiscoverPrompt,
  buildExtractPrompt,
  buildRepairPrompt,
} from "@/lib/llm/prompts";
import type { Blueprint } from "@/lib/db/schemas";

describe("LLM Prompt Templates", () => {
  const sampleBlueprint: Blueprint = {
    intent: "Extract product pricing from e-commerce catalogue",
    entity: "Product",
    fields: [
      {
        key: "product_name",
        label: "Product Name",
        type: "string",
        required: true,
        description: "Official product name",
      },
      {
        key: "price",
        label: "Price",
        type: "number",
        required: true,
        description: "Numerical price in USD",
      },
    ],
    keyFields: ["product_name"],
    sources: [{ kind: "search", query: "noise cancelling headphones" }],
    limits: {
      maxSources: 6,
      maxRecords: 20,
    },
  };

  it("builds a planner prompt containing schema and user constraints", () => {
    const prompt = buildPlannerPrompt("find job openings for junior developers in Lucknow");
    expect(prompt).toContain("find job openings for junior developers in Lucknow");
    expect(prompt).toContain("snake_case");
    expect(prompt).toContain("keyFields");
    expect(prompt).toContain("limits");
  });

  it("builds an extract prompt containing mandatory receipts and null-instead-of-guessing rules", () => {
    const prompt = buildExtractPrompt({
      blueprint: sampleBlueprint,
      sourceId: "src_abc123",
      url: "https://example.com/item/1",
      text: "Sony WH-1000XM5 headphones retail at $399 with 30-hour battery life.",
    });

    expect(prompt).toContain("evidence must be copied verbatim from the text");
    expect(prompt).toContain("return null instead of guessing");
    expect(prompt).toContain("product_name");
    expect(prompt).toContain("price");
    expect(prompt).toContain("src_abc123");
    expect(prompt).toContain("https://example.com/item/1");
  });

  it("builds a discover prompt with search query and limits", () => {
    const prompt = buildDiscoverPrompt("hiring software engineers in Lucknow", { maxSources: 5 });
    expect(prompt).toContain("hiring software engineers in Lucknow");
    expect(prompt).toContain("5");
  });

  it("builds a repair prompt including the invalid output and reason", () => {
    const prompt = buildRepairPrompt('{"unclosed": "brace', "Unexpected end of JSON input");
    expect(prompt).toContain('{"unclosed": "brace');
    expect(prompt).toContain("Unexpected end of JSON input");
    expect(prompt).toContain("valid JSON");
  });
});
