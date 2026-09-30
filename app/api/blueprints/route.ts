import { NextRequest } from "next/server";
import { z } from "zod";
import { extractWorkspaceId, jsonResponse } from "@/lib/api/workspace";
import { checkBlueprintRateLimit } from "@/lib/api/rateLimit";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { planUserPrompt } from "@/lib/llm/planner";
import { FakeLlmClient } from "@/lib/llm/fake";
import { GeminiClient } from "@/lib/llm/gemini";

const postBlueprintSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

function getLlmClient() {
  if (process.env.DEMO_MODE === "true" || !process.env.GEMINI_API_KEY) {
    return new FakeLlmClient();
  }
  return new GeminiClient();
}

export async function POST(req: NextRequest) {
  try {
    const ctx = extractWorkspaceId(req);

    // Rate limit check
    const rateCheck = checkBlueprintRateLimit(ctx.workspaceId);
    if (!rateCheck.allowed) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        429,
        { retryAfterSeconds: rateCheck.retryAfterSeconds }
      );
    }

    const body = await req.json();
    const { prompt } = postBlueprintSchema.parse(body);

    const client = getLlmClient();
    const result = await planUserPrompt(prompt, client);

    if (!result.ok) {
      return jsonResponse({ refusal: result.refusal }, ctx);
    }

    return jsonResponse(result.blueprint, ctx);
  } catch (error) {
    return handleRouteError(error);
  }
}
