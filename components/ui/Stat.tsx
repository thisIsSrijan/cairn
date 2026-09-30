"use client";

import React, { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface StatProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  prefix,
  suffix,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [animatedValue, setAnimatedValue] = useState<number>(value);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const start = 0;
    const duration = 300;
    const startTime = performance.now();

    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + (value - start) * eased);
      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    const animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [value, shouldReduceMotion]);

  const displayValue = shouldReduceMotion ? value : animatedValue;

  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <span className="font-mono text-xs uppercase tracking-wider text-ink-soft select-none">
        {label}
      </span>
      <div className="flex items-baseline gap-1 font-mono text-2xl font-medium tracking-tight text-ink tabular-nums">
        {prefix && <span className="text-base text-ink-soft">{prefix}</span>}
        <span className="tabular-nums font-mono">{displayValue.toLocaleString()}</span>
        {suffix && <span className="text-base text-ink-soft">{suffix}</span>}
      </div>
    </div>
  );
};
