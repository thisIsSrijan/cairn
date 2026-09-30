import { randomUUID } from "crypto";

export const WORKSPACE_COOKIE_NAME = "cairn_workspace_id";

export const WORKSPACE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year in seconds
};

export interface CookieItem {
  value: string;
  name?: string;
}

export interface CookieStoreLike {
  get(name: string): CookieItem | undefined;
  set(
    name: string,
    value: string,
    options?: typeof WORKSPACE_COOKIE_OPTIONS
  ): void | Promise<void> | this;
}

export function generateWorkspaceId(): string {
  const token = randomUUID().replace(/-/g, "");
  return `ws_${token}`;
}

async function resolveCookieStore(
  cookieStore?: CookieStoreLike | Promise<CookieStoreLike>
): Promise<CookieStoreLike | null> {
  if (cookieStore) {
    return await cookieStore;
  }

  try {
    const nextHeaders = await import("next/headers");
    if (typeof nextHeaders.cookies === "function") {
      const store = await nextHeaders.cookies();
      return store as unknown as CookieStoreLike;
    }
  } catch {
    // Outside request context (e.g. CLI, tests without explicit store)
  }

  return null;
}

export async function getWorkspaceId(
  cookieStore?: CookieStoreLike | Promise<CookieStoreLike>
): Promise<string | null> {
  const store = await resolveCookieStore(cookieStore);
  if (!store) {
    return null;
  }

  const existing = store.get(WORKSPACE_COOKIE_NAME);
  return existing?.value || null;
}

export async function getOrCreateWorkspaceId(
  cookieStore?: CookieStoreLike | Promise<CookieStoreLike>
): Promise<{ workspaceId: string; isNew: boolean }> {
  const store = await resolveCookieStore(cookieStore);

  if (store) {
    const existing = store.get(WORKSPACE_COOKIE_NAME);
    if (existing?.value) {
      return {
        workspaceId: existing.value,
        isNew: false,
      };
    }
  }

  const newWorkspaceId = generateWorkspaceId();

  if (store && typeof store.set === "function") {
    store.set(WORKSPACE_COOKIE_NAME, newWorkspaceId, WORKSPACE_COOKIE_OPTIONS);
  }

  return {
    workspaceId: newWorkspaceId,
    isNew: true,
  };
}
