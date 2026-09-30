"use client";

import React, { useState, useRef, useEffect } from "react";
import type { RunEvent, RunEventLevel } from "@/lib/db/schemas";

export interface FieldLogProps {
  events: RunEvent[];
  className?: string;
}

export const FieldLog: React.FC<FieldLogProps> = ({ events, className = "" }) => {
  const [levelFilter, setLevelFilter] = useState<RunEventLevel | "all">("all");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  const filteredEvents = events.filter((e) => {
    if (levelFilter === "all") return true;
    return e.level === levelFilter;
  });

  // Track scroll position to respect user manual scroll
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    userScrolledUpRef.current = !isAtBottom;
  };

  // Auto-scroll to newest event if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredEvents.length]);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return isNaN(d.getTime())
      ? "00:00:00"
      : d.toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
  };

  const isEvidenceGateRejection = (e: RunEvent) => {
    const msg = e.message.toLowerCase();
    return (
      e.level === "warn" ||
      e.level === "error" ||
      msg.includes("evidence") ||
      msg.includes("quote") ||
      msg.includes("hallucinat") ||
      msg.includes("rejected")
    );
  };

  return (
    <section
      role="region"
      aria-label="Field Log"
      className={`border border-rule rounded-xs bg-paper-2/40 flex flex-col ${className}`.trim()}
    >
      {/* Header bar with filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-3 border-b border-rule bg-paper-2/70 select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-ink font-semibold">
            Field Log
          </span>
          <span className="font-mono text-[10px] text-ink-soft bg-ink/5 px-1.5 py-0.5 rounded-xs">
            {filteredEvents.length} events
          </span>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1">
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-xs cursor-pointer transition-colors ${
                levelFilter === lvl
                  ? "bg-ink text-paper font-semibold"
                  : "text-ink-soft hover:text-ink hover:bg-ink/5"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Monospaced Log stream */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="p-3 font-mono text-xs overflow-y-auto max-h-72 sm:max-h-80 md:max-h-96 space-y-1.5 focus:outline-none"
        tabIndex={0}
        aria-label="Event log stream"
      >
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-ink-soft italic">
            Waiting for pipeline telemetry events...
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isRejection = isEvidenceGateRejection(evt);

            return (
              <div
                key={evt._id || `${evt.stage}-${new Date(evt.ts).getTime()}`}
                className={`py-1 px-1.5 rounded-xs transition-colors ${
                  isRejection
                    ? "border-l-2 border-reject bg-reject/5 pl-2"
                    : "hover:bg-ink/5"
                }`}
              >
                <div className="flex items-start gap-2 leading-relaxed">
                  <span className="text-ink-soft select-none shrink-0 tabular-nums">
                    {formatTime(evt.createdAt)}
                  </span>
                  <span className="text-ink-soft uppercase text-[10px] tracking-wider px-1 py-0.2 rounded-xs bg-ink/5 select-none shrink-0">
                    [{evt.stage}]
                  </span>
                  <span
                    className={`break-words flex-1 ${
                      evt.level === "error"
                        ? "text-reject font-medium"
                        : evt.level === "warn"
                        ? "text-caution font-medium"
                        : "text-ink"
                    }`}
                  >
                    {evt.message}
                  </span>
                </div>

                {isRejection && (
                  <div className="mt-0.5 ml-14 text-[10px] font-mono text-reject tracking-wide select-none">
                    quote not found in snapshot
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
