import React from "react";

export const BlueprintSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Planning blueprint"
      aria-busy="true"
      className="space-y-6"
    >
      <div className="flex items-center justify-between pb-3 border-b border-rule">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal animate-pulse" aria-hidden="true" />
            <div className="font-mono text-xs text-ink uppercase tracking-wider">
              Planning blueprint...
            </div>
          </div>
          <div className="h-5 w-48 bg-rule/50 rounded-xs animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-rule/40 rounded-xs animate-pulse" />
      </div>

      {/* Fields skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-20 bg-rule/40 rounded-xs animate-pulse" />
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-7 w-28 bg-rule/40 rounded-xs animate-pulse" />
          <div className="h-7 w-24 bg-rule/40 rounded-xs animate-pulse" />
          <div className="h-7 w-32 bg-rule/40 rounded-xs animate-pulse" />
          <div className="h-7 w-20 bg-rule/40 rounded-xs animate-pulse" />
        </div>
      </div>

      {/* Sources skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-rule/40 rounded-xs animate-pulse" />
        <div className="space-y-2">
          <div className="h-9 w-full bg-rule/30 rounded-xs animate-pulse" />
          <div className="h-9 w-full bg-rule/30 rounded-xs animate-pulse" />
        </div>
      </div>

      {/* Limits skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-16 bg-rule/20 rounded-xs border border-rule/50 p-2 animate-pulse" />
        <div className="h-16 bg-rule/20 rounded-xs border border-rule/50 p-2 animate-pulse" />
      </div>

      {/* Policy skeleton */}
      <div className="h-14 bg-rule/15 rounded-xs border border-rule/40 animate-pulse" />

      {/* Button skeleton */}
      <div className="pt-2">
        <div className="h-11 w-full bg-rule/50 rounded-xs animate-pulse" />
      </div>
    </div>
  );
};
