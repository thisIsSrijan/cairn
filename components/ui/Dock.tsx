"use client";

import React from "react";
import { IconAsk } from "@/components/icons/IconAsk";
import { IconTasks } from "@/components/icons/IconTasks";
import { IconDatasets } from "@/components/icons/IconDatasets";

export type DockTab = "ask" | "tasks" | "datasets";

export interface DockProps {
  activeTab: DockTab;
  onSelectTab: (tab: DockTab) => void;
  className?: string;
}

export const Dock: React.FC<DockProps> = ({
  activeTab,
  onSelectTab,
  className = "",
}) => {
  const items: Array<{
    id: DockTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "ask", label: "Ask", icon: IconAsk },
    { id: "tasks", label: "Tasks", icon: IconTasks },
    { id: "datasets", label: "Datasets", icon: IconDatasets },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)] md:w-auto bg-paper/95 backdrop-blur-sm border border-rule rounded-xs shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom)] ${className}`.trim()}
    >
      <div className="flex items-center justify-around gap-1 p-1 md:px-3">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[72px] px-3 py-1.5 rounded-xs font-mono text-[11px] uppercase tracking-wider transition-colors duration-fast cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal ${
                isActive
                  ? "text-ink font-semibold bg-ink/10"
                  : "text-ink-soft hover:text-ink hover:bg-ink/5"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? "text-signal scale-105" : ""}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
