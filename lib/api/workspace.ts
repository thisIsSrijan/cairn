import { NextResponse, type NextRequest } from "next/server";
import {
  WORKSPACE_COOKIE_NAME,
  WORKSPACE_COOKIE_OPTIONS,
  generateWorkspaceId,
} from "@/lib/workspace";

export interface WorkspaceContext {
  workspaceId: string;
  isNew: boolean;
}

export function extractWorkspaceId(req: Request | NextRequest): WorkspaceContext {
  if ("cookies" in req && req.cookies && typeof req.cookies.get === "function") {
    const cookie = req.cookies.get(WORKSPACE_COOKIE_NAME);
    if (cookie?.value) {
      return {
        workspaceId: cookie.value,
        isNew: false,
      };
    }
  }

  const cookieHeader = req.headers.get("cookie") || req.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith(`${WORKSPACE_COOKIE_NAME}=`)) {
        const val = decodeURIComponent(c.slice(`${WORKSPACE_COOKIE_NAME}=`.length));
        if (val) {
          return {
            workspaceId: val,
            isNew: false,
          };
        }
      }
    }
  }

  return {
    workspaceId: generateWorkspaceId(),
    isNew: true,
  };
}

export function jsonResponse<T>(
  data: T,
  ctx: WorkspaceContext,
  status = 200
): NextResponse<T> {
  const res = NextResponse.json(data, { status });

  if (ctx.isNew) {
    res.cookies.set(
      WORKSPACE_COOKIE_NAME,
      ctx.workspaceId,
      WORKSPACE_COOKIE_OPTIONS
    );
  }

  return res;
}
