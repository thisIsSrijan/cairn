"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { RunStage } from "@/lib/db/schemas";
import { easings } from "@/lib/motion";

export interface CairnBuilderProps {
  currentStage: RunStage;
  isComplete?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

interface StoneConfig {
  stage: RunStage;
  label: string;
  type: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  rotation?: number;
}

const STONES: StoneConfig[] = [
  {
    stage: "planning",
    label: "Planning",
    type: "rect",
    x: 25,
    y: 176,
    width: 90,
    height: 18,
    rx: 6,
  },
  {
    stage: "discovering",
    label: "Discovering",
    type: "rect",
    x: 32,
    y: 155,
    width: 76,
    height: 17,
    rx: 5.5,
    rotation: -1.5,
  },
  {
    stage: "fetching",
    label: "Fetching",
    type: "rect",
    x: 39,
    y: 135,
    width: 64,
    height: 16,
    rx: 5,
    rotation: 1,
  },
  {
    stage: "extracting",
    label: "Extracting",
    type: "rect",
    x: 45,
    y: 116,
    width: 52,
    height: 15,
    rx: 4.5,
    rotation: -1,
  },
  {
    stage: "validating",
    label: "Validating",
    type: "rect",
    x: 50,
    y: 98,
    width: 42,
    height: 14,
    rx: 4,
    rotation: 0.5,
  },
  {
    stage: "deduping",
    label: "Deduping",
    type: "rect",
    x: 55,
    y: 81,
    width: 34,
    height: 14,
    rx: 3.5,
    rotation: -0.5,
  },
  {
    stage: "verifying",
    label: "Verifying",
    type: "rect",
    x: 59,
    y: 65,
    width: 26,
    height: 13,
    rx: 3,
  },
  {
    stage: "complete",
    label: "Complete",
    type: "circle",
    x: 72,
    y: 47,
    width: 14,
    height: 14,
    rx: 7,
  },
];

const STAGE_ORDER: RunStage[] = [
  "planning",
  "discovering",
  "fetching",
  "extracting",
  "validating",
  "deduping",
  "verifying",
  "complete",
];

export const CairnBuilder: React.FC<CairnBuilderProps> = ({
  currentStage,
  isComplete = false,
  className = "",
  size = "md",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const currentIndex = isComplete
    ? STAGE_ORDER.length
    : STAGE_ORDER.indexOf(currentStage);

  const sizeStyles = {
    sm: "w-28 h-36",
    md: "w-40 h-52",
    lg: "w-52 h-68",
  }[size];

  return (
    <div
      role="img"
      aria-label="Cairn stage stack: 8 stages"
      className={`relative inline-flex items-center justify-center select-none ${sizeStyles} ${className}`.trim()}
    >
      <svg
        viewBox="0 0 144 216"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        {/* Ground ledger rule */}
        <line
          x1="12"
          y1="198"
          x2="132"
          y2="198"
          stroke="var(--color-rule)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* 8 Stone Layers */}
        {STONES.map((stone, index) => {
          let status: "completed" | "active" | "upcoming" = "upcoming";
          if (isComplete) {
            status = "completed";
          } else if (index < currentIndex) {
            status = "completed";
          } else if (index === currentIndex) {
            status = "active";
          }

          const isTopCircle = stone.type === "circle";
          const transformOrigin = `${stone.x + stone.width / 2}px ${
            stone.y + stone.height / 2
          }px`;

          // Animations
          const dropTransition = {
            duration: shouldReduceMotion ? 0 : 0.38,
            ease: easings.ledger,
          };

          // For active stones: pulse opacity gently. We use a separate animate
          // object cast to TargetAndTransition to avoid union type conflict.
          const isPulse = !shouldReduceMotion && status === "active";

          return (
            <g
              key={stone.stage}
              data-testid={`cairn-stone-${stone.stage}`}
              data-status={status}
              role="presentation"
              transform={
                stone.rotation
                  ? `rotate(${stone.rotation} ${stone.x + stone.width / 2} ${
                      stone.y + stone.height / 2
                    })`
                  : undefined
              }
            >
              <title>{stone.label}: {status}</title>
              {isTopCircle ? (
                // Top stone (Signal Circle)
                <motion.circle
                  cx={stone.x}
                  cy={stone.y}
                  r={stone.rx}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { scale: 0.6, y: -16, opacity: 0 }
                  }
                  animate={
                    status === "completed"
                      ? { scale: 1, y: 0, opacity: 1 }
                      : status === "active"
                      ? { scale: [1, 1.025, 1], y: 0, opacity: [0.85, 1, 0.85] }
                      : { scale: 1, y: 0, opacity: 0.35 }
                  }
                  transition={
                    isPulse
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : dropTransition
                  }
                  fill={
                    status === "completed" || status === "active"
                      ? "var(--color-signal)"
                      : "none"
                  }
                  stroke={
                    status === "upcoming"
                      ? "var(--color-rule)"
                      : "var(--color-signal)"
                  }
                  strokeWidth="1.5"
                  strokeDasharray={status === "upcoming" ? "2 3" : undefined}
                />
              ) : (
                // Standard stage stone (Rectangular block)
                <motion.rect
                  x={stone.x}
                  y={stone.y}
                  width={stone.width}
                  height={stone.height}
                  rx={stone.rx}
                  style={{ transformOrigin }}
                  initial={
                    shouldReduceMotion
                      ? false
                      : { y: -12, opacity: 0, scaleY: 0.9 }
                  }
                  animate={
                    status === "completed"
                      ? { y: 0, opacity: 1, scaleY: 1 }
                      : status === "active"
                      ? { y: 0, opacity: [0.85, 1, 0.85], scaleY: 1 }
                      : { y: 0, opacity: 0.35, scaleY: 1 }
                  }
                  transition={
                    isPulse
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : dropTransition
                  }
                  fill={
                    status === "completed"
                      ? "var(--color-ink)"
                      : status === "active"
                      ? "var(--color-ink-soft)"
                      : "none"
                  }
                  stroke={
                    status === "active"
                      ? "var(--color-signal)"
                      : status === "completed"
                      ? "var(--color-rule)"
                      : "var(--color-rule)"
                  }
                  strokeWidth={status === "active" ? "1.5" : "1"}
                  strokeDasharray={status === "upcoming" ? "2 3" : undefined}
                />
              )}

              {/* Settle dust particle on completed stone */}
              {status === "completed" && !shouldReduceMotion && (
                <motion.circle
                  cx={stone.x + stone.width + 4}
                  cy={stone.y + stone.height}
                  r="1.25"
                  fill="var(--color-rule)"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1, 0], opacity: [0, 0.7, 0] }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
