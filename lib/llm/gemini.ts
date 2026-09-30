import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { blueprintSchema, type Blueprint } from "@/lib/db/schemas";
import {
  type LlmClient,
  type DiscoverLimits,
  type DiscoverResult,
  type ExtractParams,
  type ExtractedRow,
  LlmError,
  TokenBudgetExceededError,
} from "./types";
import {
  buildPlannerPrompt,
  buildDiscoverPrompt,
  buildExtractPrompt,
  buildRepairPrompt,
} from "./prompts";

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  modelLite?: string;
  tokenBudget?: number;
  retryBaseDelayMs?: number;
}

const extractedCellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  evidence: z.string().describe("Exact quote copied verbatim from the page text"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
});

const extractResponseSchema = z.object({
  rows: z.array(z.record(z.string(), extractedCellSchema)),
});

function extractHttpStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.statusCode === "number") return obj.statusCode;
    if (typeof obj.code === "number") return obj.code;
    if (typeof obj.response === "object" && obj.response !== null) {
      const resp = obj.response as Record<string, unknown>;
      if (typeof resp.status === "number") return resp.status;
    }
  }
  if (err instanceof Error) {
    const match = err.message.match(/\b(429|500|502|503|504)\b/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

export class GeminiClient implements LlmClient {
  private ai: GoogleGenAI;
  private model: string;
  private modelLite: string;
  private tokenBudget?: number;
  private usedTokens = 0;
  private retryBaseDelayMs: number;

  constructor(options: GeminiClientOptions = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for GeminiClient");
    }

    const model = options.model || process.env.GEMINI_MODEL;
    if (!model) {
      throw new Error("GEMINI_MODEL is required for GeminiClient");
    }

    const modelLite = options.modelLite || process.env.GEMINI_MODEL_LITE || model;

    this.ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        retryOptions: {
          attempts: 1,
        },
      },
    });
    this.model = model;
    this.modelLite = modelLite;
    this.tokenBudget = options.tokenBudget;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
  }

  private async executeWithRetry<T extends { usageMetadata?: { totalTokenCount?: number } }>(
    fn: () => Promise<T>
  ): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.tokenBudget !== undefined && this.usedTokens >= this.tokenBudget) {
        throw new TokenBudgetExceededError();
      }

      try {
        const response = await fn();
        const total = response.usageMetadata?.totalTokenCount ?? 0;
        this.usedTokens += total;

        if (this.tokenBudget !== undefined && this.usedTokens > this.tokenBudget) {
          throw new TokenBudgetExceededError();
        }

        return response;
      } catch (err: unknown) {
        if (err instanceof TokenBudgetExceededError) {
          throw err;
        }

        lastError = err;
        const status = extractHttpStatus(err);
        const isRetryable =
          status === 429 || (status !== undefined && status >= 500 && status < 600);

        if (attempt < maxAttempts && isRetryable) {
          const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
    }

    const status = extractHttpStatus(lastError);
    throw new LlmError(
      `Gemini request failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      {
        code: status === 429 ? "RATE_LIMITED" : "API_ERROR",
        status,
        cause: lastError,
      }
    );
  }

  private async attemptRepair<T>(
    invalidOutput: string,
    errorMessage: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema);
    const repairPrompt = buildRepairPrompt(invalidOutput, errorMessage);

    const repairResponse = await this.executeWithRetry(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: repairPrompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      })
    );

    const repairedText = repairResponse.text ?? "";
    try {
      const json = JSON.parse(repairedText);
      const parsed = schema.safeParse(json);
      if (parsed.success) {
        return parsed.data;
      }
      throw new LlmError(
        `Schema validation failed after repair attempt: ${parsed.error.message}`,
        { code: "SCHEMA_VALIDATION_ERROR", cause: parsed.error }
      );
    } catch (err: unknown) {
      if (err instanceof LlmError) throw err;
      throw new LlmError(
        `Failed to parse repaired JSON: ${err instanceof Error ? err.message : String(err)}`,
        { code: "INVALID_JSON", cause: err }
      );
    }
  }

  private async parseAndValidate<T>(
    text: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    try {
      const json = JSON.parse(text);
      const parsed = schema.safeParse(json);
      if (parsed.success) {
        return parsed.data;
      }
      return await this.attemptRepair(text, parsed.error.message, schema);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return await this.attemptRepair(text, errMsg, schema);
    }
  }

  async planBlueprint(prompt: string): Promise<Blueprint> {
    const jsonSchema = z.toJSONSchema(blueprintSchema);
    const promptText = buildPlannerPrompt(prompt);

    const response = await this.executeWithRetry(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      })
    );

    return await this.parseAndValidate(response.text ?? "", blueprintSchema);
  }

  async discover(query: string, limits?: DiscoverLimits): Promise<DiscoverResult> {
    const promptText = buildDiscoverPrompt(query, limits);

    const response = await this.executeWithRetry(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: promptText,
        config: {
          tools: [{ googleSearch: {} }],
        },
      })
    );

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const seenUrls = new Set<string>();
    const urls: Array<{ url: string; title: string }> = [];

    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        const uri = chunk.web.uri;
        if (!seenUrls.has(uri)) {
          seenUrls.add(uri);
          urls.push({
            url: uri,
            title: chunk.web.title || uri,
          });
        }
      }
    }

    const maxSources = limits?.maxSources ?? 12;
    const finalUrls = urls.slice(0, maxSources);

    return {
      summary: response.text ?? "",
      urls: finalUrls,
    };
  }

  async extract(params: ExtractParams): Promise<ExtractedRow[]> {
    const jsonSchema = z.toJSONSchema(extractResponseSchema);
    const promptText = buildExtractPrompt(params);

    const response = await this.executeWithRetry(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      })
    );

    const parsed = await this.parseAndValidate(response.text ?? "", extractResponseSchema);
    return parsed.rows;
  }
}
