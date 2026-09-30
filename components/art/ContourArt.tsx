"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  generateContours,
  generateTrailWithWaypoints,
} from "@/lib/art/contours";
import { easings } from "@/lib/motion";

export interface ContourArtProps {
  seed?: number;
  className?: string;
  width?: number;
  height?: number;
  interactive?: boolean;
}

export const ContourArt: React.FC<ContourArtProps> = ({
  seed = 42,
  className = "",
  width = 800,
  height = 420,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const contours = useMemo(() => {
    return generateContours({
      seed,
      width,
      height,
      contourCount: 6,
    });
  }, [seed, width, height]);

  const trail = useMemo(() => {
    return generateTrailWithWaypoints({
      seed,
      width,
      height,
    });
  }, [seed, width, height]);

  const duration = shouldReduceMotion ? 0 : 0.9;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden ${className}`.trim()}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-rule"
      >
        {/* Topographic elevation contours */}
        {contours.map((d, index) => (
          <motion.path
            key={`contour-${index}`}
            d={d}
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity={0.4 + index * 0.08}
            initial={shouldReduceMotion ? { opacity: 0.6 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{
              duration,
              delay: shouldReduceMotion ? 0 : index * 0.08,
              ease: easings.ledger,
            }}
          />
        ))}

        {/* Dotted surveyor trail echoing receipt verification */}
        <motion.path
          d={trail.path}
          stroke="var(--color-signal)"
          strokeWidth="1.25"
          strokeDasharray="4 6"
          strokeOpacity={0.7}
          initial={shouldReduceMotion ? { opacity: 0.7 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{
            duration: duration * 1.2,
            delay: shouldReduceMotion ? 0 : 0.3,
            ease: easings.ledger,
          }}
        />

        {/* 3 Waypoints along the collection trail */}
        {trail.waypoints.map((wp, index) => (
          <g key={wp.id}>
            <motion.circle
              cx={wp.x}
              cy={wp.y}
              r="4.5"
              fill="var(--color-paper)"
              stroke="var(--color-signal)"
              strokeWidth="1.5"
              initial={shouldReduceMotion ? { scale: 1 } : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.3,
                delay: shouldReduceMotion ? 0 : 0.5 + index * 0.12,
                ease: easings.ledger,
              }}
            />
            <motion.circle
              cx={wp.x}
              cy={wp.y}
              r="1.75"
              fill="var(--color-signal)"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.6 + index * 0.12,
              }}
            />
            <motion.text
              x={wp.x + 8}
              y={wp.y - 6}
              fill="var(--color-ink-soft)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
              textAnchor="start"
              className="uppercase font-mono select-none"
              initial={shouldReduceMotion ? { opacity: 0.8 } : { opacity: 0, y: -2 }}
              animate={{ opacity: 0.8, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.7 + index * 0.12,
              }}
            >
              {wp.label}
            </motion.text>
          </g>
        ))}
      </svg>
    </div>
  );
};
