import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { GeminiClient } from "@/lib/llm/gemini";
import { LlmError, TokenBudgetExceededError } from "@/lib/llm/types";
import type { Blueprint } from "@/lib/db/schemas";

const sampleBlueprint: Blueprint = {
  intent: "Job search",
  entity: "JobOpening",
  fields: [
    { key: "job_title", label: "Job Title", type: "string", required: true, description: "" },
    { key: "company", label: "Company", type: "string", required: true, description: "" },
    { key: "location", label: "Location", type: "string", required: true, description: "" },
  ],
  keyFields: ["job_title"],
  sources: [{ kind: "search", query: "jobs in lucknow" }],
  limits: { maxSources: 5, maxRecords: 10 },
};

describe("GeminiClient", () => {
  let capturedBodies: Array<Record<string, unknown>> = [];
  let retryCount = 0;
  let forceErrorStatus: number | null = null;
  let respondWithInvalidJsonOnce = false;

  const server = setupServer(
    http.post("https://generativelanguage.googleapis.com/*", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      capturedBodies.push(body);

      if (forceErrorStatus) {
        retryCount++;
        if (retryCount < 3 && forceErrorStatus === 429) {
          // Recover on third try for 429
          return HttpResponse.json(
            { error: { code: 429, message: "Resource exhausted" } },
            { status: 429 }
          );
        }
        if (forceErrorStatus === 503) {
          return HttpResponse.json(
            { error: { code: 503, message: "Service unavailable" } },
            { status: 503 }
          );
        }
      }

      if (respondWithInvalidJsonOnce) {
        respondWithInvalidJsonOnce = false;
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: "{ incomplete json string" }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
        });
      }

      // Check if it's discover query (has tools with googleSearch)
      const tools = body.tools as Array<{ googleSearch?: unknown }> | undefined;

      if (tools && tools.some((t) => t.googleSearch !== undefined)) {
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: "Found Lucknow developer positions online." }],
                role: "model",
              },
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: "https://example.com/job1", title: "Job 1" } },
                  { web: { uri: "https://example.com/job2", title: "Job 2" } },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 25, candidatesTokenCount: 35, totalTokenCount: 60 },
        });
      }

      // Default structured output response
      const promptText = JSON.stringify(body);

      if (promptText.includes("repair the output")) {
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(sampleBlueprint) }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25, totalTokenCount: 40 },
        });
      }

      if (promptText.includes("Cairn Extractor") || promptText.includes("MANDATORY RECEIPT RULES")) {
        const extractPayload = {
          rows: [
            {
              job_title: {
                value: "Senior Lead",
                evidence: "Hiring a Senior Lead engineer in Lucknow.",
                confidence: 0.95,
              },
              company: {
                value: "Acme Corp",
                evidence: "Acme Corp has opened positions.",
                confidence: 0.98,
              },
              location: {
                value: "Lucknow",
                evidence: "Office based in Lucknow.",
                confidence: 0.99,
              },
            },
          ],
        };
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(extractPayload) }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 80, totalTokenCount: 120 },
        });
      }

      // Blueprint response
      return HttpResponse.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(sampleBlueprint) }],
              role: "model",
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 70, totalTokenCount: 100 },
      });
    })
  );

  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    capturedBodies = [];
    retryCount = 0;
    forceErrorStatus = null;
    respondWithInvalidJsonOnce = false;
  });
  afterAll(() => server.close());

  it("plans blueprint with structured output schema and no tools", async () => {
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 1,
    });

    const blueprint = await client.planBlueprint("jobs in Lucknow");
    expect(blueprint.entity).toBe("JobOpening");

    expect(capturedBodies.length).toBeGreaterThan(0);
    const lastBody = capturedBodies[0];
    const config = (lastBody.generationConfig ?? lastBody.config) as Record<string, unknown>;
    expect(config.responseMimeType).toBe("application/json");
    expect(lastBody.tools).toBeUndefined();
  });

  it("discovers URLs using googleSearch grounding tool without structured output", async () => {
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 1,
    });

    const res = await client.discover("jobs in Lucknow", { maxSources: 5 });
    expect(res.summary).toContain("Lucknow");
    expect(res.urls.length).toBe(2);
    expect(res.urls[0].url).toBe("https://example.com/job1");

    const lastBody = capturedBodies[0];
    const tools = lastBody.tools as Array<{ googleSearch?: unknown }> | undefined;
    expect(tools).toBeDefined();
    expect(tools?.some((t) => t.googleSearch !== undefined)).toBe(true);

    const config = (lastBody.generationConfig ?? lastBody.config) as Record<string, unknown> | undefined;
    expect(config?.responseMimeType).toBeUndefined();
  });

  it("extracts rows with exact evidence and confidence values", async () => {
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 1,
    });

    const rows = await client.extract({
      blueprint: sampleBlueprint,
      sourceId: "src_1",
      url: "https://example.com/posting",
      text: "Hiring a Senior Lead engineer in Lucknow. Acme Corp has opened positions. Office based in Lucknow.",
    });

    expect(rows.length).toBe(1);
    expect(rows[0].job_title.value).toBe("Senior Lead");
    expect(rows[0].job_title.evidence).toContain("Senior Lead");
    expect(rows[0].job_title.confidence).toBeGreaterThan(0.9);
  });

  it("retries on 429 and succeeds on later attempt", async () => {
    forceErrorStatus = 429;
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 5,
    });

    const blueprint = await client.planBlueprint("jobs in Lucknow");
    expect(blueprint.entity).toBe("JobOpening");
    expect(retryCount).toBe(3);
  });

  it("fails with typed LlmError after 3 consecutive 5xx errors", async () => {
    forceErrorStatus = 503;
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 5,
    });

    await expect(client.planBlueprint("jobs in Lucknow")).rejects.toThrow(LlmError);
  });

  it("enforces per-run token budget and throws TokenBudgetExceededError", async () => {
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      tokenBudget: 150,
      retryBaseDelayMs: 1,
    });

    // First call uses 100 tokens (remaining budget: 50)
    await client.planBlueprint("jobs in Lucknow");

    // Second call uses 100 tokens, which exceeds 150 total budget
    await expect(client.planBlueprint("jobs in Lucknow")).rejects.toThrow(
      TokenBudgetExceededError
    );
  });

  it("repairs invalid JSON once when initial generation is malformed", async () => {
    respondWithInvalidJsonOnce = true;
    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 1,
    });

    const blueprint = await client.planBlueprint("jobs in Lucknow");
    expect(blueprint.entity).toBe("JobOpening");
    expect(capturedBodies.length).toBe(2); // First failed call + repair call
  });

  it("throws when GEMINI_API_KEY or GEMINI_MODEL is missing", () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origModel = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    try {
      expect(() => new GeminiClient({ apiKey: "" })).toThrow(/GEMINI_API_KEY is required/i);
      expect(() => new GeminiClient({ apiKey: "some-key", model: "" })).toThrow(
        /GEMINI_MODEL is required/i
      );
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
      if (origModel) process.env.GEMINI_MODEL = origModel;
    }
  });

  it("throws typed LlmError when repair also produces invalid output", async () => {
    server.use(
      http.post("https://generativelanguage.googleapis.com/*", () => {
        return HttpResponse.json({
          candidates: [
            {
              content: { parts: [{ text: "not json at all" }], role: "model" },
              finishReason: "STOP",
            },
          ],
        });
      })
    );

    const client = new GeminiClient({
      apiKey: "test-api-key",
      model: "test-gemini-model",
      retryBaseDelayMs: 1,
    });

    await expect(client.planBlueprint("jobs in Lucknow")).rejects.toThrow(LlmError);
  });
});

