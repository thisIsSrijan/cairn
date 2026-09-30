"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { IconClose } from "@/components/icons/IconClose";
import { easings, durations } from "@/lib/motion";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  children,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : durations.fast,
              ease: easings.ledger,
            }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{
              duration: shouldReduceMotion ? 0 : durations.normal,
              ease: easings.ledger,
            }}
            drag={shouldReduceMotion ? false : "y"}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
            className={`relative z-10 w-full max-w-xl max-h-[85dvh] overflow-y-auto bg-paper border-t border-rule rounded-t-[10px] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)] p-5 pb-8 ${className}`.trim()}
          >
            <div className="flex justify-center pb-3">
              <div
                className="h-1 w-10 rounded-full bg-rule"
                aria-hidden="true"
              />
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-rule mb-4">
              <h2 className="font-display text-lg font-medium text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sheet"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="text-sm text-ink">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
