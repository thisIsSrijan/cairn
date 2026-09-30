import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRunDriver } from "@/hooks/useRunDriver";
import type { Run, RunEvent } from "@/lib/db/schemas";

const baseMockRun: Run = {
  _id: "run-123",
  workspaceId: "ws-1",
  workflowId: "wf-1",
  // "discovering" is a valid RunStatus value
  status: "discovering",
  stage: "discovering",
  cursor: {
    sourcesDiscovered: 2,
    sourcesFetched: 0,
    sourcesExtracted: 0,
    sourceRetries: {},
  },
  counts: {
    sourcesFound: 2,
    sourcesFetched: 0,
    valuesExtracted: 0,
    valuesRejected: 0,
    recordsKept: 0,
    duplicatesMerged: 0,
    verified: 0,
    unverified: 0,
  },
  createdAt: new Date(),
  error: null,
  startedAt: null,
  finishedAt: null,
  previousRunId: null,
};

const mockEvent: RunEvent = {
  _id: "evt-1",
  workspaceId: "ws-1",
  runId: "run-123",
  ts: new Date(),
  stage: "discovering",
  level: "info",
  message: "Discovered 2 seed sources",
  meta: {},
  createdAt: new Date(),
};

describe("useRunDriver Hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("advances active run and fetches events in loop", async () => {
    let advanceCallCount = 0;
    let currentMockRun: Run = { ...baseMockRun };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/advance")) {
        advanceCallCount++;
        const nextStage = advanceCallCount >= 2 ? "complete" : "fetching";
        const nextStatus = advanceCallCount >= 2 ? "complete" : "fetching";
        currentMockRun = {
          ...currentMockRun,
          stage: nextStage,
          status: nextStatus,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(currentMockRun),
        });
      }

      if (url.includes("/api/runs/run-123")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              run: currentMockRun,
              counts: currentMockRun.counts,
              events: [mockEvent],
            }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    const { result } = renderHook(() =>
      useRunDriver("run-123", {
        pollingIntervalMs: 50,
      })
    );

    // Wait until run reaches complete terminal state
    await waitFor(
      () => {
        expect(result.current.run?.status).toBe("complete");
      },
      { timeout: 3000 }
    );

    expect(result.current.isTerminal).toBe(true);
    expect(result.current.events.length).toBeGreaterThanOrEqual(1);
    expect(result.current.events[0].message).toBe("Discovered 2 seed sources");
  });

  it("handles pause, resume, and cancel actions", async () => {
    // "discovering" is a valid active RunStatus; "paused"/"cancelled" are terminal or paused
    let currentStatus: Run["status"] = "discovering";

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/pause")) {
        currentStatus = "paused";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...baseMockRun, status: "paused" }),
        });
      }
      if (url.endsWith("/resume")) {
        currentStatus = "discovering";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...baseMockRun, status: "discovering" }),
        });
      }
      if (url.endsWith("/cancel")) {
        currentStatus = "cancelled";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...baseMockRun, status: "cancelled" }),
        });
      }
      if (url.includes("/advance")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...baseMockRun, status: currentStatus }),
        });
      }
      if (url.includes("/api/runs/run-123")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              run: { ...baseMockRun, status: currentStatus },
              counts: baseMockRun.counts,
              events: [],
            }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    const { result } = renderHook(() =>
      useRunDriver("run-123", { pollingIntervalMs: 100 })
    );

    // Pause
    await act(async () => {
      await result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);

    // Resume
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.isPaused).toBe(false);

    // Cancel
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.run?.status).toBe("cancelled");
    expect(result.current.isTerminal).toBe(true);
  });

  it("pauses looping when document is hidden and resumes when visible", async () => {
    let advanceCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/advance")) {
        advanceCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...baseMockRun, status: "discovering" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            run: baseMockRun,
            counts: baseMockRun.counts,
            events: [],
          }),
      });
    });

    const { unmount } = renderHook(() =>
      useRunDriver("run-123", { pollingIntervalMs: 50 })
    );

    await waitFor(() => {
      expect(advanceCount).toBeGreaterThanOrEqual(1);
    });

    // Simulate switching tabs (document becomes hidden)
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const countWhenHidden = advanceCount;

    // Wait a brief tick, advance should not fire while hidden
    await new Promise((r) => setTimeout(r, 120));
    expect(advanceCount).toBe(countWhenHidden);

    // Simulate switching back (document becomes visible)
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(advanceCount).toBeGreaterThan(countWhenHidden);
    });

    unmount();
  });
});
