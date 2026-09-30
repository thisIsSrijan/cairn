"use client";

import { notFound } from "next/navigation";
import React, { useState } from "react";
import { CairnMark } from "@/components/brand/CairnMark";
import { CairnWordmark } from "@/components/brand/CairnWordmark";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { Rule } from "@/components/ui/Rule";
import { Sheet } from "@/components/ui/Sheet";
import { Dock, type DockTab } from "@/components/ui/Dock";
import {
  IconAsk,
  IconTasks,
  IconDatasets,
  IconSource,
  IconReceipt,
  IconCheck,
  IconCross,
  IconFlag,
  IconPause,
  IconPlay,
  IconStop,
  IconRefresh,
  IconFilter,
  IconSearch,
  IconDownload,
  IconLink,
  IconClock,
  IconPlus,
  IconClose,
  IconChevron,
  IconDiff,
  IconShield,
} from "@/components/icons";

export default function KitPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [activeTab, setActiveTab] = useState<DockTab>("ask");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">("auto");
  const [selectedChips, setSelectedChips] = useState<Record<string, boolean>>({
    caching: true,
    verification: false,
    strictRobots: true,
  });

  const toggleTheme = (mode: "auto" | "light" | "dark") => {
    setThemeMode(mode);
    if (mode === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  };

  const allIcons = [
    { name: "ask", Component: IconAsk },
    { name: "tasks", Component: IconTasks },
    { name: "datasets", Component: IconDatasets },
    { name: "source", Component: IconSource },
    { name: "receipt", Component: IconReceipt },
    { name: "check", Component: IconCheck },
    { name: "cross", Component: IconCross },
    { name: "flag", Component: IconFlag },
    { name: "pause", Component: IconPause },
    { name: "play", Component: IconPlay },
    { name: "stop", Component: IconStop },
    { name: "refresh", Component: IconRefresh },
    { name: "filter", Component: IconFilter },
    { name: "search", Component: IconSearch },
    { name: "download", Component: IconDownload },
    { name: "link", Component: IconLink },
    { name: "clock", Component: IconClock },
    { name: "plus", Component: IconPlus },
    { name: "close", Component: IconClose },
    { name: "chevron", Component: IconChevron },
    { name: "diff", Component: IconDiff },
    { name: "shield", Component: IconShield },
  ];

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-paper text-ink px-4 py-8 pb-32 md:px-8"
    >
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header Section */}
        <header className="border-b border-rule pb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CairnMark className="w-8 h-8 text-ink" />
              <CairnWordmark className="text-2xl" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Theme
              </span>
              <div className="flex rounded-xs border border-rule p-0.5 bg-paper-2">
                {(["auto", "light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => toggleTheme(mode)}
                    className={`px-2.5 py-1 font-mono text-xs uppercase tracking-wider rounded-xs cursor-pointer select-none transition-colors ${
                      themeMode === mode
                        ? "bg-ink text-paper font-semibold"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
              Design System Kit
            </h1>
            <p className="font-sans text-sm text-ink-soft max-w-xl">
              Surveyor field ledger specifications: paper substrate, ink typography, hairline
              rules, and one signal color.
            </p>
          </div>
        </header>

        {/* Brand Specimen */}
        <section aria-labelledby="brand-heading" className="space-y-4">
          <h2
            id="brand-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            01. Brand Marks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-rule rounded-xs p-6 bg-paper-2 flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex items-center gap-3">
                <CairnMark className="w-12 h-12 text-ink" />
                <CairnWordmark className="text-3xl" />
              </div>
              <span className="font-mono text-xs text-ink-soft">
                Cairn Mark (three stones) with Wordmark in Fraunces
              </span>
            </div>

            <div className="border border-rule rounded-xs p-6 bg-paper-2 flex items-center justify-around">
              <div className="flex flex-col items-center gap-2">
                <CairnMark className="w-6 h-6 text-ink" />
                <span className="font-mono text-[11px] text-ink-soft">24px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CairnMark className="w-8 h-8 text-ink" />
                <span className="font-mono text-[11px] text-ink-soft">32px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CairnMark className="w-12 h-12 text-ink" />
                <span className="font-mono text-[11px] text-ink-soft">48px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CairnMark className="w-16 h-16 text-ink" />
                <span className="font-mono text-[11px] text-ink-soft">64px</span>
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette Tokens */}
        <section aria-labelledby="colors-heading" className="space-y-4">
          <h2
            id="colors-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            02. Ledger Color Tokens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { name: "paper", hex: "#F3EFE6", bgClass: "bg-[#F3EFE6]" },
              { name: "paper-2", hex: "#EAE4D6", bgClass: "bg-[#EAE4D6]" },
              { name: "ink", hex: "#1B1A17", bgClass: "bg-[#1B1A17]" },
              { name: "ink-soft", hex: "#5B574D", bgClass: "bg-[#5B574D]" },
              { name: "rule", hex: "#D5CDB9", bgClass: "bg-[#D5CDB9]" },
              { name: "signal", hex: "#D9482B", bgClass: "bg-[#D9482B]" },
              { name: "verified", hex: "#2F6F62", bgClass: "bg-[#2F6F62]" },
              { name: "caution", hex: "#8C5708", bgClass: "bg-[#8C5708]" },
              { name: "reject", hex: "#8C2F39", bgClass: "bg-[#8C2F39]" },
            ].map((token) => (
              <div
                key={token.name}
                className="border border-rule rounded-xs p-3 space-y-2 bg-paper"
              >
                <div
                  aria-hidden="true"
                  className={`h-12 w-full rounded-xs border border-rule/50 ${token.bgClass}`}
                />
                <div>
                  <div className="font-mono text-xs font-semibold text-ink">
                    {token.name}
                  </div>
                  <div className="font-mono text-[10px] text-ink-soft">
                    {token.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section aria-labelledby="type-heading" className="space-y-4">
          <h2
            id="type-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            03. Typography Hierarchy
          </h2>
          <div className="border border-rule rounded-xs p-6 bg-paper-2 space-y-6">
            <div className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Display: Fraunces
              </span>
              <p className="font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
                Every cell carries its receipt.
              </p>
            </div>

            <Rule />

            <div className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                UI & Body: Hanken Grotesk
              </span>
              <p className="font-sans text-sm text-ink leading-relaxed max-w-prose">
                Cairn interprets plain-language requests into editable blueprints, runs automated
                collections over permitted sources, and renders verified receipts for every extracted data cell.
              </p>
            </div>

            <Rule />

            <div className="space-y-1">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Data & Micro-Labels: JetBrains Mono (Tabular Numerals)
              </span>
              <p className="font-mono text-xs uppercase tracking-wider text-ink">
                SOURCE ID: SRC-08492 // VERDICT: VERIFIED_MATCH // CONFIDENCE: 0.985
              </p>
            </div>
          </div>
        </section>

        {/* Hand-Authored 24px Icons */}
        <section aria-labelledby="icons-heading" className="space-y-4">
          <h2
            id="icons-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            04. Custom Icons (24px Grid, 1.5px Stroke, Round Caps)
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {allIcons.map(({ name, Component }) => (
              <div
                key={name}
                className="flex flex-col items-center justify-center gap-2 p-3 border border-rule rounded-xs bg-paper-2 hover:border-ink-soft transition-colors text-center"
              >
                <Component className="w-6 h-6 text-ink" />
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft truncate w-full">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2
            id="buttons-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            05. Button Primitives
          </h2>
          <div className="border border-rule rounded-xs p-6 bg-paper-2 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Signal</Button>
              <Button variant="secondary">Secondary Outline</Button>
              <Button variant="quiet">Quiet Ghost</Button>
              <Button variant="primary" loading>
                Processing
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">
                Small (32px)
              </Button>
              <Button variant="primary" size="md">
                Medium (44px)
              </Button>
              <Button variant="primary" size="lg">
                Large (48px)
              </Button>
            </div>
          </div>
        </section>

        {/* Chips */}
        <section aria-labelledby="chips-heading" className="space-y-4">
          <h2
            id="chips-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            06. Chip Primitives
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label="Robots.txt Policy"
              selected={selectedChips.strictRobots}
              onClick={() =>
                setSelectedChips((prev) => ({
                  ...prev,
                  strictRobots: !prev.strictRobots,
                }))
              }
            />
            <Chip
              label="Verbatim Proof"
              selected={selectedChips.verification}
              onClick={() =>
                setSelectedChips((prev) => ({
                  ...prev,
                  verification: !prev.verification,
                }))
              }
            />
            <Chip
              label="Snapshot Caching"
              selected={selectedChips.caching}
              onClick={() =>
                setSelectedChips((prev) => ({
                  ...prev,
                  caching: !prev.caching,
                }))
              }
            />
            <Chip
              label="Removable Domain"
              onRemove={() => {}}
            />
          </div>
        </section>

        {/* Form Fields */}
        <section aria-labelledby="fields-heading" className="space-y-4">
          <h2
            id="fields-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            07. Field Primitives
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="kit-source-domain"
              label="Allowed Domain"
              placeholder="e.g. news.ycombinator.com"
              helperText="Obey robots.txt and max 1 request/sec rate limit."
            />

            <Field
              id="kit-error-field"
              label="Collection Target"
              defaultValue="https://invalid-format"
              error="Valid HTTPS URL required for permitted web harvest."
            />

            <div className="md:col-span-2">
              <Field
                multiline
                id="kit-blueprint-prompt"
                label="Extraction Objective"
                placeholder="Describe target entities and requested columns in plain English..."
                helperText="Gemini will produce an editable blueprint before collecting data."
              />
            </div>
          </div>
        </section>

        {/* Status Badges */}
        <section aria-labelledby="badges-heading" className="space-y-4">
          <h2
            id="badges-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            08. Status Badges
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="verified" dot>
              Verified (Receipt Validated)
            </Badge>
            <Badge variant="caution" dot>
              Caution (Confidence &lt; 0.70)
            </Badge>
            <Badge variant="reject" dot>
              Reject (Discrepancy)
            </Badge>
            <Badge variant="neutral">Neutral Status</Badge>
          </div>
        </section>

        {/* Stats */}
        <section aria-labelledby="stats-heading" className="space-y-4">
          <h2
            id="stats-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            09. Stat Primitives (Tabular Ticker)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-rule rounded-xs p-6 bg-paper-2">
            <Stat label="Harvested Records" value={284} />
            <Stat label="Verified Receipts" value={279} suffix=" / 284" />
            <Stat label="Accuracy Rate" value={98} suffix="%" />
          </div>
        </section>

        {/* Sheet & Drawer Interaction */}
        <section aria-labelledby="sheet-heading" className="space-y-4">
          <h2
            id="sheet-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            10. Receipt Sheet Drawer (Framer Motion Drag)
          </h2>
          <div className="border border-rule rounded-xs p-6 bg-paper-2 space-y-4">
            <p className="font-sans text-sm text-ink-soft">
              Every cell in Cairn carries its receipt. Tap to inspect source URL, exact verbatim quote, and validator verdict.
            </p>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open Receipt Drawer
            </Button>
          </div>

          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Receipt Verification Drawer"
          >
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-rule">
                <span className="text-ink-soft uppercase tracking-wider">
                  Status
                </span>
                <Badge variant="verified" dot>
                  Verified Verbatim
                </Badge>
              </div>

              <div className="space-y-1">
                <span className="text-ink-soft uppercase tracking-wider">
                  Source URL
                </span>
                <div className="p-2 bg-paper-2 rounded-xs border border-rule text-ink break-all">
                  https://example.com/press/releases/q4-report
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-ink-soft uppercase tracking-wider">
                  Verbatim Snapshot Quote
                </span>
                <div className="p-3 bg-paper-2 rounded-xs border-l-2 border-verified text-ink">
                  &ldquo;Revenue increased 42% year-over-year reaching $184M in annual recurring revenue.&rdquo;
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-ink-soft uppercase tracking-wider">
                    Fetched At
                  </span>
                  <div className="text-ink">2026-09-30 16:24:00 UTC</div>
                </div>
                <div>
                  <span className="text-ink-soft uppercase tracking-wider">
                    Confidence
                  </span>
                  <div className="text-ink">0.985 (Pass)</div>
                </div>
              </div>
            </div>
          </Sheet>
        </section>

        {/* Floating Dock */}
        <section aria-labelledby="dock-heading" className="space-y-4">
          <h2
            id="dock-heading"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft border-b border-rule pb-2"
          >
            11. Floating Bottom Dock Navigation
          </h2>
          <div className="border border-rule rounded-xs p-6 bg-paper-2 space-y-2">
            <p className="font-sans text-sm text-ink-soft">
              Active destination: <strong className="font-mono uppercase text-ink">{activeTab}</strong>
            </p>
            <p className="font-sans text-xs text-ink-soft">
              Fixed dock rendered at the bottom of the viewport with safe-area spacing and minimum 44px touch targets.
            </p>
          </div>
        </section>
      </div>

      {/* Dock instance mounted for mobile interaction */}
      <Dock activeTab={activeTab} onSelectTab={setActiveTab} />
    </main>
  );
}
