"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Run, RunCounts, RunEvent } from "@/lib/db/schemas";

const DEFAULT_COUNTS: RunCounts = {
  sourcesFound: 0,
  sourcesFetched: 0,
  valuesExtracted: 0,
  valuesRejected: 0,
  recordsKept: 0,
  duplicatesMerged: 0,
  verified: 0,
  unverified: 0,
};

export interface UseRunDriverOptions {
  enabled?: boolean;
  initialRun?: Run | null;
  pollingIntervalMs?: number;
  onComplete?: (run: Run) => void;
  onError?: (err: Error) => void;
}

export interface UseRunDriverResult {
  run: Run | null;
  counts: RunCounts;
  events: RunEvent[];
  isAdvancing: boolean;
  isPolling: boolean;
  isTerminal: boolean;
  isPaused: boolean;
  error: Error | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRunDriver(
  runId: string,
  options: UseRunDriverOptions = {}
): UseRunDriverResult {
  const {
    enabled = true,
    initialRun = null,
    pollingIntervalMs = 500,
    onComplete,
    onError,
  } = options;

  const [run, setRun] = useState<Run | null>(initialRun);
  const [counts, setCounts] = useState<RunCounts>(
    initialRun?.counts || DEFAULT_COUNTS
  );
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const isTerminal =
    run?.status === "complete" ||
    run?.status === "failed" ||
    run?.status === "cancelled";
  const isPaused = run?.status === "paused";

  const runRef = useRef<Run | null>(run);
  useEffect(() => {
    runRef.current = run;
  });

  const isMountedRef = useRef(true);
  const activeLoopRef = useRef(false);
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const backoffDelayRef = useRef(0);

  // Poll latest run and events
  const pollRunAndEvents = useCallback(async () => {
    if (!runId || !isMountedRef.current) return;
    setIsPolling(true);
    try {
      const url = lastEventIdRef.current
        ? `/api/runs/${runId}?after=${encodeURIComponent(lastEventIdRef.current)}`
        : `/api/runs/${runId}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch run state: ${res.status}`);
      }

      const data = await res.json();
      if (!isMountedRef.current) return;

      if (data.run) {
        setRun(data.run);
      }
      if (data.counts) {
        setCounts(data.counts);
      }
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e._id));
          const newEvents = data.events.filter(
            (e: RunEvent) => !existingIds.has(e._id)
          );
          if (newEvents.length === 0) return prev;
          const merged = [...prev, ...newEvents];
          // Sort by ts date ascending (server-assigned)
          merged.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          lastEventIdRef.current = merged[merged.length - 1]._id;
          return merged;
        });
      }
      setError(null);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
      }
    } finally {
      if (isMountedRef.current) {
        setIsPolling(false);
      }
    }
  }, [runId, onError]);

  // Advance pipeline step
  const executeAdvance = useCallback(async (): Promise<boolean> => {
    if (!runId || !isMountedRef.current) return false;
    setIsAdvancing(true);

    try {
      const res = await fetch(`/api/runs/${runId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Advance failed: ${res.status}`);
      }

      const updatedRun: Run = await res.json();
      if (!isMountedRef.current) return false;

      setRun(updatedRun);
      if (updatedRun.counts) {
        setCounts(updatedRun.counts);
      }

      // Reset backoff on success
      backoffDelayRef.current = 0;
      setError(null);

      if (updatedRun.status === "complete") {
        onComplete?.(updatedRun);
      }

      return (
        updatedRun.status !== "complete" &&
        updatedRun.status !== "failed" &&
        updatedRun.status !== "cancelled" &&
        updatedRun.status !== "paused"
      );
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
        // Exponential backoff up to 8s
        backoffDelayRef.current = Math.min(
          8000,
          (backoffDelayRef.current || 500) * 2
        );
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsAdvancing(false);
      }
    }
  }, [runId, onComplete, onError]);

  // Main loop driving the collection machine
  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled || !runId) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const runLoop = async () => {
      if (isCancelled || !isMountedRef.current || activeLoopRef.current) return;
      activeLoopRef.current = true;

      try {
        while (!isCancelled && isMountedRef.current) {
          // Check visibility
          if (typeof document !== "undefined" && document.hidden) {
            break;
          }

          // Check if terminal or paused
          const current = runRef.current;
          if (
            current &&
            (current.status === "complete" ||
              current.status === "failed" ||
              current.status === "cancelled" ||
              current.status === "paused")
          ) {
            break;
          }

          // Poll latest events and stats
          await pollRunAndEvents();

          // Advance one bounded batch
          const shouldContinue = await executeAdvance();

          // Also poll events after advance
          await pollRunAndEvents();

          if (!shouldContinue || isCancelled || !isMountedRef.current) {
            break;
          }

          const delay = backoffDelayRef.current || pollingIntervalMs;
          await new Promise((resolve) => {
            timeoutId = setTimeout(resolve, delay);
          });
        }
      } finally {
        activeLoopRef.current = false;
      }
    };

    runLoop();

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (!document.hidden && !activeLoopRef.current) {
        runLoop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, runId, pollingIntervalMs, pollRunAndEvents, executeAdvance]);

  // Controls
  const pause = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${runId}/pause`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setRun(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [runId]);

  const resume = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${runId}/resume`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setRun(updated);
        // Trigger loop immediately
        pollRunAndEvents();
        executeAdvance();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [runId, pollRunAndEvents, executeAdvance]);

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setRun(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [runId]);

  return {
    run,
    counts,
    events,
    isAdvancing,
    isPolling,
    isTerminal,
    isPaused,
    error,
    pause,
    resume,
    cancel,
    refresh: pollRunAndEvents,
  };
}
