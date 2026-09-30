import { describe, it, expect, vi } from "vitest";
import {
  getOrCreateWorkspaceId,
  getWorkspaceId,
  generateWorkspaceId,
  WORKSPACE_COOKIE_NAME,
  WORKSPACE_COOKIE_OPTIONS,
  type CookieStoreLike,
} from "@/lib/workspace";

describe("Workspace ID management", () => {
  it("generates distinct non-empty workspace identifiers", () => {
    const id1 = generateWorkspaceId();
    const id2 = generateWorkspaceId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe("string");
  });

  it("reads an existing workspace ID from cookie without generating a new one", async () => {
    const existingId = "ws_existing_ledger_123";
    const getMock = vi.fn().mockReturnValue({ value: existingId });
    const setMock = vi.fn();

    const mockStore: CookieStoreLike = {
      get: getMock,
      set: setMock,
    };

    const result = await getOrCreateWorkspaceId(mockStore);

    expect(getMock).toHaveBeenCalledWith(WORKSPACE_COOKIE_NAME);
    expect(setMock).not.toHaveBeenCalled();
    expect(result.workspaceId).toBe(existingId);
    expect(result.isNew).toBe(false);
  });

  it("creates a new workspace ID and writes httpOnly lax cookie when missing", async () => {
    const getMock = vi.fn().mockReturnValue(undefined);
    const setMock = vi.fn();

    const mockStore: CookieStoreLike = {
      get: getMock,
      set: setMock,
    };

    const result = await getOrCreateWorkspaceId(mockStore);

    expect(getMock).toHaveBeenCalledWith(WORKSPACE_COOKIE_NAME);
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(result.isNew).toBe(true);
    expect(result.workspaceId).toBeTruthy();

    const [cookieName, cookieValue, cookieOpts] = setMock.mock.calls[0] ?? [];
    expect(cookieName).toBe(WORKSPACE_COOKIE_NAME);
    expect(cookieValue).toBe(result.workspaceId);
    expect(cookieOpts.httpOnly).toBe(true);
    expect(cookieOpts.sameSite).toBe("lax");
    expect(cookieOpts.path).toBe("/");
    expect(cookieOpts.maxAge).toBeGreaterThan(0);
  });

  it("returns null from getWorkspaceId when cookie is absent", async () => {
    const mockStore: CookieStoreLike = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
    };

    const id = await getWorkspaceId(mockStore);
    expect(id).toBeNull();
  });

  it("returns existing id from getWorkspaceId when cookie is present", async () => {
    const mockStore: CookieStoreLike = {
      get: vi.fn().mockReturnValue({ value: "ws_persisted_456" }),
      set: vi.fn(),
    };

    const id = await getWorkspaceId(mockStore);
    expect(id).toBe("ws_persisted_456");
  });

  it("exports required cookie security options", () => {
    expect(WORKSPACE_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(WORKSPACE_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(WORKSPACE_COOKIE_OPTIONS.path).toBe("/");
  });

  it("handles call without arguments outside request context", async () => {
    const res = await getOrCreateWorkspaceId();
    expect(res.workspaceId).toBeTruthy();
    expect(res.isNew).toBe(true);

    const id = await getWorkspaceId();
    expect(id).toBeNull();
  });
});
