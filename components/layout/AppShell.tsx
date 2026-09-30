"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DesktopRail } from "./DesktopRail";
import { Dock, type DockTab } from "@/components/ui/Dock";

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  if (pathname.startsWith("/kit")) {
    return (
      <div className="min-h-[100dvh] bg-paper text-ink selection:bg-signal selection:text-black">
        {children}
      </div>
    );
  }

  let activeTab: DockTab = "ask";
  if (pathname.startsWith("/tasks")) {
    activeTab = "tasks";
  } else if (pathname.startsWith("/datasets")) {
    activeTab = "datasets";
  }

  const handleSelectTab = (tab: DockTab) => {
    if (tab === "ask") {
      router.push("/");
    } else {
      router.push(`/${tab}`);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-paper text-ink selection:bg-signal selection:text-black">
      {/* Slim left rail on desktop */}
      <DesktopRail />

      {/* Main page content area */}
      <div className="md:pl-16 min-h-[100dvh] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex-1 pb-24 md:pb-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating dock on mobile only */}
      <div className="md:hidden">
        <Dock activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
    </div>
  );
};
