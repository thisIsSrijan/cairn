"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CairnMark } from "@/components/brand/CairnMark";
import { IconAsk } from "@/components/icons/IconAsk";
import { IconTasks } from "@/components/icons/IconTasks";
import { IconDatasets } from "@/components/icons/IconDatasets";
import { IconTheme } from "@/components/icons/IconTheme";
import { useTheme } from "@/hooks/useTheme";

export const DesktopRail: React.FC = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    {
      href: "/",
      label: "Ask",
      microLabel: "ASK",
      icon: IconAsk,
      isActive: pathname === "/",
    },
    {
      href: "/tasks",
      label: "Tasks",
      microLabel: "TASKS",
      icon: IconTasks,
      isActive: pathname.startsWith("/tasks"),
    },
    {
      href: "/datasets",
      label: "Datasets",
      microLabel: "DATA",
      icon: IconDatasets,
      isActive: pathname.startsWith("/datasets"),
    },
  ];

  return (
    <aside
      aria-label="Desktop Navigation"
      className="hidden md:flex flex-col items-center justify-between fixed top-0 bottom-0 left-0 w-16 bg-paper border-r border-rule z-40 py-5 select-none"
    >
      {/* Brand logo at top */}
      <Link
        href="/"
        aria-label="Cairn Home"
        className="p-2 rounded-xs text-ink hover:text-signal transition-colors focus-visible:outline-2 focus-visible:outline-signal"
      >
        <CairnMark className="w-7 h-7" />
      </Link>

      {/* Primary destinations */}
      <nav className="flex flex-col items-center gap-3 w-full px-2" aria-label="Main Menu">
        {navItems.map(({ href, label, microLabel, icon: Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 w-full min-h-[48px] py-2 rounded-xs font-mono text-[10px] uppercase tracking-wider transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-signal ${
              isActive
                ? "text-ink font-semibold bg-ink/10"
                : "text-ink-soft hover:text-ink hover:bg-ink/5"
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? "text-signal scale-105" : ""}`} />
            <span>{microLabel}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom spacer / theme toggle / ledger mark */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          className="p-2 rounded-xs text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal"
        >
          <IconTheme className="w-5 h-5" />
        </button>

        <div
          aria-hidden="true"
          className="flex flex-col items-center gap-1 text-[10px] font-mono text-ink-soft tracking-widest"
        >
          <span>6.0</span>
        </div>
      </div>
    </aside>
  );
};
