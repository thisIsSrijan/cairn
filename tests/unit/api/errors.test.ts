import { describe, it, expect } from "vitest";
import { z } from "zod";
import { errorResponse, handleRouteError } from "@/lib/api/errors";
import { LlmError, TokenBudgetExceededError } from "@/lib/llm/types";

describe("API Error Handling", () => {
  it("formats errorResponse with code, message, and details", async () => {
    const res = errorResponse("TEST_ERR", "Something failed", 400, { key: "value" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TEST_ERR");
    expect(body.error.message).toBe("Something failed");
    expect(body.error.details).toEqual({ key: "value" });
  });

  it("handles ZodError as 400 validation error", async () => {
    const schema = z.object({ num: z.number() });
    const parsed = schema.safeParse({ num: "not-a-number" });
    expect(parsed.success).toBe(false);

    if (!parsed.success) {
      const res = handleRouteError(parsed.error);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
    }
  });

  it("handles TokenBudgetExceededError as 429", async () => {
    const err = new TokenBudgetExceededError("Run exceeded 1000 tokens");
    const res = handleRouteError(err);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("TOKEN_BUDGET_EXCEEDED");
    expect(body.error.message).toBe("Run exceeded 1000 tokens");
  });

  it("handles LlmError with RATE_LIMITED as 429 and generic as 502", async () => {
    const rateLimitedErr = new LlmError("Quota exhausted", { code: "RATE_LIMITED" });
    const rateRes = handleRouteError(rateLimitedErr);
    expect(rateRes.status).toBe(429);
    const rateBody = await rateRes.json();
    expect(rateBody.error.code).toBe("RATE_LIMITED");

    const genericLlmErr = new LlmError("Bad response from provider", { code: "BAD_PROVIDER" });
    const genericRes = handleRouteError(genericLlmErr);
    expect(genericRes.status).toBe(502);
    const genericBody = await genericRes.json();
    expect(genericBody.error.code).toBe("BAD_PROVIDER");
  });

  it("handles generic Error with not found as 404 and other as 500", async () => {
    const notFoundErr = new Error("Record not found");
    const notFoundRes = handleRouteError(notFoundErr);
    expect(notFoundRes.status).toBe(404);
    const notFoundBody = await notFoundRes.json();
    expect(notFoundBody.error.code).toBe("NOT_FOUND");

    const serverErr = new Error("Database timeout");
    const serverRes = handleRouteError(serverErr);
    expect(serverRes.status).toBe(500);
    const serverBody = await serverRes.json();
    expect(serverBody.error.code).toBe("INTERNAL_ERROR");

    const unknownErr = "String exception";
    const unknownRes = handleRouteError(unknownErr);
    expect(unknownRes.status).toBe(500);
    const unknownBody = await unknownRes.json();
    expect(unknownBody.error.code).toBe("UNKNOWN_ERROR");
  });
});
