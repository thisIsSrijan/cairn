"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconClose } from "@/components/icons/IconClose";
import { IconPlus } from "@/components/icons/IconPlus";
import { IconShield } from "@/components/icons/IconShield";
import { BlueprintSkeleton } from "./BlueprintSkeleton";
import { BlueprintRefusal } from "./BlueprintRefusal";
import { easings, durations } from "@/lib/motion";
import type { Blueprint, BlueprintField, BlueprintSource } from "@/lib/db/schemas";
import type { PlannerRefusal } from "@/lib/llm/planner";

export interface BlueprintReviewProps {
  open: boolean;
  loading: boolean;
  blueprint: Blueprint | null;
  refusal?: PlannerRefusal | null;
  error?: string | null;
  onClose: () => void;
  onStart: (blueprint: Blueprint) => void;
  starting?: boolean;
}

export const BlueprintReview: React.FC<BlueprintReviewProps> = ({
  open,
  loading,
  blueprint: initialBlueprint,
  refusal,
  error,
  onClose,
  onStart,
  starting = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [prevInitial, setPrevInitial] = useState<Blueprint | null>(initialBlueprint);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(initialBlueprint);

  // Sync state when initialBlueprint changes across renders
  if (initialBlueprint !== prevInitial) {
    setPrevInitial(initialBlueprint);
    setBlueprint(initialBlueprint);
  }

  // Field editing state
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRequired, setEditRequired] = useState(false);

  // Add field state
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Add source state
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceKind, setNewSourceKind] = useState<"search" | "url">("search");
  const [newSourceValue, setNewSourceValue] = useState("");

  // Allowlist state
  const [customAllowlist, setCustomAllowlist] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");

  // Focus trap ref
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key handler
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

  // Auto focus first interactive item on open
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  // Handlers for fields
  const handleStartEditField = (index: number) => {
    if (!blueprint) return;
    const f = blueprint.fields[index];
    setEditingFieldIndex(index);
    setEditLabel(f.label);
    setEditRequired(f.required ?? false);
  };

  const handleSaveField = () => {
    if (!blueprint || editingFieldIndex === null) return;
    const trimmed = editLabel.trim();
    if (!trimmed) return;

    const updatedFields = [...blueprint.fields];
    updatedFields[editingFieldIndex] = {
      ...updatedFields[editingFieldIndex],
      label: trimmed,
      required: editRequired,
    };

    setBlueprint({
      ...blueprint,
      fields: updatedFields,
    });
    setEditingFieldIndex(null);
  };

  const handleRemoveField = (index: number) => {
    if (!blueprint || blueprint.fields.length <= 1) return;
    const updatedFields = blueprint.fields.filter((_, i) => i !== index);
    setBlueprint({
      ...blueprint,
      fields: updatedFields,
    });
  };

  const handleAddField = () => {
    if (!blueprint) return;
    const trimmed = newFieldLabel.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const newField: BlueprintField = {
      key: `${key}_${Date.now().toString().slice(-4)}`,
      label: trimmed,
      type: "string",
      required: newFieldRequired,
      description: "",
    };

    setBlueprint({
      ...blueprint,
      fields: [...blueprint.fields, newField],
    });
    setNewFieldLabel("");
    setNewFieldRequired(false);
    setIsAddingField(false);
  };

  // Handlers for limits steppers
  const handleStepSources = (delta: number) => {
    if (!blueprint) return;
    const current = blueprint.limits.maxSources;
    const next = Math.max(1, Math.min(12, current + delta));
    setBlueprint({
      ...blueprint,
      limits: {
        ...blueprint.limits,
        maxSources: next,
      },
    });
  };

  const handleStepRecords = (delta: number) => {
    if (!blueprint) return;
    const current = blueprint.limits.maxRecords;
    const next = Math.max(1, Math.min(100, current + delta));
    setBlueprint({
      ...blueprint,
      limits: {
        ...blueprint.limits,
        maxRecords: next,
      },
    });
  };

  // Handlers for sources
  const handleRemoveSource = (index: number) => {
    if (!blueprint || blueprint.sources.length <= 1) return;
    const updated = blueprint.sources.filter((_, i) => i !== index);
    setBlueprint({
      ...blueprint,
      sources: updated,
    });
  };

  const handleAddSource = () => {
    if (!blueprint) return;
    const trimmed = newSourceValue.trim();
    if (!trimmed) return;

    const newSource: BlueprintSource =
      newSourceKind === "search"
        ? { kind: "search", query: trimmed }
        : { kind: "url", url: trimmed };

    setBlueprint({
      ...blueprint,
      sources: [...blueprint.sources, newSource],
    });
    setNewSourceValue("");
    setIsAddingSource(false);
  };

  // Handlers for allowlist
  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!trimmed || customAllowlist.includes(trimmed)) return;
    setCustomAllowlist([...customAllowlist, trimmed]);
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    setCustomAllowlist(customAllowlist.filter((d) => d !== domain));
  };

  const defaultDenylist = [
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
        {/* Backdrop */}
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

        {/* Panel: bottom sheet on mobile, right slide-over on desktop */}
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={blueprint ? `Blueprint: ${blueprint.entity}` : "Collection Blueprint"}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : typeof window !== "undefined" && window.innerWidth >= 768
              ? { x: "100%" }
              : { y: "100%" }
          }
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : typeof window !== "undefined" && window.innerWidth >= 768
              ? { x: "100%" }
              : { y: "100%" }
          }
          transition={{
            duration: shouldReduceMotion ? 0 : durations.normal,
            ease: easings.ledger,
          }}
          className="relative z-10 w-full md:max-w-lg lg:max-w-xl max-h-[88dvh] md:max-h-none md:h-full overflow-y-auto bg-paper border-t md:border-t-0 md:border-l border-rule rounded-t-[10px] md:rounded-none shadow-2xl p-5 md:p-6 pb-8"
        >
          {/* Mobile grab handle */}
          <div className="flex justify-center pb-2 md:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-rule" />
          </div>

          {/* Panel Header */}
          <div className="flex items-center justify-between pb-3 border-b border-rule mb-5">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Blueprint Review
              </span>
              <h2 className="font-display text-lg font-medium text-ink">
                {loading
                  ? "Formulating plan"
                  : refusal
                  ? "Collection Boundary"
                  : blueprint
                  ? blueprint.entity
                  : "Collection Blueprint"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sheet"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-ink-soft hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-signal"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 mb-4 rounded-xs border border-reject/40 bg-reject/5 text-sm text-reject">
              {error}
            </div>
          )}

          {/* Content States */}
          {loading ? (
            <BlueprintSkeleton />
          ) : refusal ? (
            <BlueprintRefusal refusal={refusal} onClose={onClose} />
          ) : blueprint ? (
            <div className="space-y-6">
              {/* Intent */}
              <div className="space-y-1">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                  Collection Intent
                </span>
                <p className="text-sm text-ink-soft italic leading-relaxed">
                  &ldquo;{blueprint.intent}&rdquo;
                </p>
              </div>

              {/* Fields Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                    Fields to Extract ({blueprint.fields.length})
                  </span>
                  {!isAddingField && (
                    <button
                      type="button"
                      onClick={() => setIsAddingField(true)}
                      className="font-mono text-xs text-signal hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-signal rounded-xs px-1"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>Add field</span>
                    </button>
                  )}
                </div>

                {/* Field editor modal/inline box */}
                {editingFieldIndex !== null && (
                  <div className="p-3 bg-paper-2 border border-rule rounded-xs space-y-3">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink">
                      Edit Field
                    </span>
                    <div>
                      <label
                        htmlFor="edit-field-label"
                        className="block font-mono text-xs text-ink-soft mb-1"
                      >
                        Field Label
                      </label>
                      <input
                        id="edit-field-label"
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full bg-paper px-2.5 py-1.5 text-xs text-ink border border-rule rounded-xs focus:outline-none focus:border-signal"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-ink">
                      <input
                        type="checkbox"
                        checked={editRequired}
                        onChange={(e) => setEditRequired(e.target.checked)}
                        className="accent-signal"
                        aria-label="Required"
                      />
                      <span>Required field</span>
                    </label>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setEditingFieldIndex(null)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleSaveField}>
                        Save field
                      </Button>
                    </div>
                  </div>
                )}

                {/* Add field box */}
                {isAddingField && (
                  <div className="p-3 bg-paper-2 border border-rule rounded-xs space-y-3">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink">
                      Add New Field
                    </span>
                    <div>
                      <label
                        htmlFor="new-field-label"
                        className="block font-mono text-xs text-ink-soft mb-1"
                      >
                        Field Label
                      </label>
                      <input
                        id="new-field-label"
                        type="text"
                        placeholder="e.g. Work Location"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        className="w-full bg-paper px-2.5 py-1.5 text-xs text-ink border border-rule rounded-xs focus:outline-none focus:border-signal"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-ink">
                      <input
                        type="checkbox"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="accent-signal"
                      />
                      <span>Required field</span>
                    </label>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setIsAddingField(false)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleAddField}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {/* Fields list */}
                <div className="flex flex-wrap gap-2">
                  {blueprint.fields.map((field, idx) => (
                    <div
                      key={field.key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-xs border border-rule bg-paper-2 text-ink"
                    >
                      <span className="font-medium">{field.label}</span>
                      {field.required && (
                        <span
                          title="Required field"
                          className="text-signal font-bold text-xs"
                        >
                          *
                        </span>
                      )}
                      <span className="text-[10px] text-ink-soft font-mono uppercase">
                        ({field.type})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEditField(idx)}
                        aria-label={`Edit ${field.label}`}
                        className="ml-1 text-ink-soft hover:text-ink cursor-pointer focus-visible:outline-1 focus-visible:outline-signal"
                      >
                        edit
                      </button>
                      {blueprint.fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          aria-label={`Remove ${field.label}`}
                          className="text-ink-soft hover:text-reject cursor-pointer focus-visible:outline-1 focus-visible:outline-reject ml-0.5"
                        >
                          <IconClose className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sources Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                    Target Sources ({blueprint.sources.length})
                  </span>
                  {!isAddingSource && (
                    <button
                      type="button"
                      onClick={() => setIsAddingSource(true)}
                      className="font-mono text-xs text-signal hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-signal rounded-xs px-1"
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      <span>Add source</span>
                    </button>
                  )}
                </div>

                {/* Add Source Box */}
                {isAddingSource && (
                  <div className="p-3 bg-paper-2 border border-rule rounded-xs space-y-2">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink">
                      Add Source
                    </span>
                    <div className="flex gap-2">
                      <select
                        value={newSourceKind}
                        onChange={(e) =>
                          setNewSourceKind(e.target.value as "search" | "url")
                        }
                        className="bg-paper border border-rule px-2 py-1 text-xs font-mono rounded-xs text-ink"
                      >
                        <option value="search">Search</option>
                        <option value="url">URL</option>
                      </select>
                      <input
                        type="text"
                        placeholder={
                          newSourceKind === "search"
                            ? "Search query..."
                            : "https://..."
                        }
                        value={newSourceValue}
                        onChange={(e) => setNewSourceValue(e.target.value)}
                        className="flex-1 bg-paper px-2.5 py-1 text-xs text-ink border border-rule rounded-xs focus:outline-none focus:border-signal"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setIsAddingSource(false)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleAddSource}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sources list */}
                <div className="space-y-1.5">
                  {blueprint.sources.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-paper-2 border border-rule rounded-xs text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded-xs bg-ink/5 text-ink-soft">
                          {s.kind}
                        </span>
                        <span className="truncate text-ink">
                          {s.kind === "search" ? s.query : s.url}
                        </span>
                      </div>
                      {blueprint.sources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(idx)}
                          aria-label={`Remove source ${idx + 1}`}
                          className="text-ink-soft hover:text-reject cursor-pointer p-1"
                        >
                          <IconClose className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Limits Steppers */}
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                  Collection Limits
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Max Sources */}
                  <div className="p-3 bg-paper-2 border border-rule rounded-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs text-ink-soft uppercase tracking-wider">
                        Max Sources
                      </div>
                      <div className="font-mono text-xl font-semibold text-ink">
                        {blueprint.limits.maxSources}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label="Increase max sources"
                        onClick={() => handleStepSources(1)}
                        disabled={blueprint.limits.maxSources >= 12}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-xs bg-paper border border-rule text-xs hover:bg-ink/5 disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label="Decrease max sources"
                        onClick={() => handleStepSources(-1)}
                        disabled={blueprint.limits.maxSources <= 1}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-xs bg-paper border border-rule text-xs hover:bg-ink/5 disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                    </div>
                  </div>

                  {/* Max Records */}
                  <div className="p-3 bg-paper-2 border border-rule rounded-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs text-ink-soft uppercase tracking-wider">
                        Max Records
                      </div>
                      <div className="font-mono text-xl font-semibold text-ink">
                        {blueprint.limits.maxRecords}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label="Increase max records"
                        onClick={() => handleStepRecords(1)}
                        disabled={blueprint.limits.maxRecords >= 100}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-xs bg-paper border border-rule text-xs hover:bg-ink/5 disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label="Decrease max records"
                        onClick={() => handleStepRecords(-1)}
                        disabled={blueprint.limits.maxRecords <= 1}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-xs bg-paper border border-rule text-xs hover:bg-ink/5 disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Permitted Sources Panel */}
              <div className="p-3.5 bg-paper-2 border border-rule rounded-xs space-y-3">
                <div className="flex items-center gap-1.5 text-ink font-mono text-xs uppercase tracking-wider">
                  <IconShield className="w-4 h-4 text-verified" />
                  <span>Permitted Sources Policy</span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  CairnBot/1.0 obeys robots.txt, respects a 1 request/second domain rate limit, avoids login-walled pages, and verifies verbatim quotes.
                </p>

                {/* Read-only Denylist */}
                <div className="space-y-1">
                  <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wider block">
                    Default Denylist (Read-only)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {defaultDenylist.map((domain) => (
                      <span
                        key={domain}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs bg-reject/10 text-reject border border-reject/20"
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Allowlist input */}
                <div className="space-y-1 pt-1">
                  <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wider block">
                    Custom Allowlist
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. acme-jobs.org"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDomain();
                        }
                      }}
                      className="flex-1 bg-paper px-2 py-1 text-xs font-mono text-ink border border-rule rounded-xs focus:outline-none focus:border-signal"
                    />
                    <Button size="sm" variant="secondary" onClick={handleAddDomain}>
                      Add
                    </Button>
                  </div>
                  {customAllowlist.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {customAllowlist.map((d) => (
                        <Chip
                          key={d}
                          label={d}
                          onRemove={() => handleRemoveDomain(d)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-rule">
                <Button
                  variant="primary"
                  size="lg"
                  loading={starting}
                  disabled={starting || blueprint.fields.length === 0}
                  onClick={() => onStart(blueprint)}
                  className="w-full"
                >
                  Start collecting
                </Button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
