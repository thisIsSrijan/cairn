import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LlmError, TokenBudgetExceededError } from "@/lib/llm/types";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}

export function handleRouteError(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof ZodError) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Request validation failed",
      400,
      error.issues
    );
  }

  if (error instanceof TokenBudgetExceededError) {
    return errorResponse(
      "TOKEN_BUDGET_EXCEEDED",
      error.message,
      429
    );
  }

  if (error instanceof LlmError) {
    const status = error.code === "RATE_LIMITED" ? 429 : (error.status ?? 502);
    return errorResponse(error.code, error.message, status);
  }

  if (error instanceof Error) {
    if (error.message.includes("not found") || error.message.includes("Not found")) {
      return errorResponse("NOT_FOUND", error.message, 404);
    }
    return errorResponse("INTERNAL_ERROR", error.message, 500);
  }

  return errorResponse("UNKNOWN_ERROR", "An unexpected error occurred", 500);
}
