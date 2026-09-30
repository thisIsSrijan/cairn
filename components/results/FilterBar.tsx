"use client";

import React, { useState, useEffect, useId } from "react";
import { IconSearch } from "@/components/icons/IconSearch";
import { IconFilter } from "@/components/icons/IconFilter";
import { IconCross } from "@/components/icons/IconCross";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

export interface FilterState {
  search: string;
  status: "all" | "verified" | "unverified" | "contradicted";
  minConfidence: number;
  sourceDomain: string;
  fieldPresence: string;
}

export interface FilterBarProps {
  filters: FilterState;
  fields: Array<{ key: string; label: string }>;
  domains: string[];
  onFilterChange: (filters: FilterState) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  fields,
  domains,
  onFilterChange,
}) => {
  const [prevSearch, setPrevSearch] = useState(filters.search);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const minConfidenceId = useId();
  const domainSelectId = useId();
  const fieldSelectId = useId();

  // Sync internal search input with external filters during render
  if (filters.search !== prevSearch) {
    setPrevSearch(filters.search);
    setSearchInput(filters.search);
  }

  // Debounce search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({
          ...filters,
          search: searchInput,
        });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFilterChange]);

  const activeFiltersCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.minConfidence > 0 ? 1 : 0) +
    (filters.sourceDomain ? 1 : 0) +
    (filters.fieldPresence ? 1 : 0);

  const handleStatusChange = (status: FilterState["status"]) => {
    onFilterChange({
      ...filters,
      status,
    });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onFilterChange({
      ...filters,
      minConfidence: isNaN(val) ? 0 : val,
    });
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      sourceDomain: e.target.value,
    });
  };

  const handleFieldPresenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      fieldPresence: e.target.value,
    });
  };

  const handleReset = () => {
    setSearchInput("");
    onFilterChange({
      search: "",
      status: "all",
      minConfidence: 0,
      sourceDomain: "",
      fieldPresence: "",
    });
  };

  return (
    <div className="space-y-3">
      {/* Search and Mobile Filter Trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-soft">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search records in text index..."
            aria-label="Search records"
            className="w-full bg-paper border border-rule rounded-xs pl-9 pr-9 py-2 font-mono text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:border-signal transition-colors h-11"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                onFilterChange({ ...filters, search: "" });
              }}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-soft hover:text-ink cursor-pointer"
            >
              <IconCross className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter Button */}
        <button
          type="button"
          onClick={() => setIsMobileSheetOpen(true)}
          className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-paper border border-rule rounded-xs font-mono text-xs text-ink hover:border-signal cursor-pointer shrink-0 h-11"
          aria-label="Filters"
        >
          <IconFilter className="w-4 h-4 text-ink-soft" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-signal text-paper text-[10px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop Inline Filter Bar */}
      <div className="hidden md:flex flex-wrap items-center gap-3 bg-paper-2/60 border border-rule rounded-xs p-3 font-mono text-xs">
        {/* Status filters */}
        <div className="flex items-center gap-1 border-r border-rule pr-3">
          {(["all", "verified", "unverified", "contradicted"] as const).map(
            (statusKey) => {
              const active = filters.status === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => handleStatusChange(statusKey)}
                  className={`px-2.5 py-1 rounded-xs uppercase tracking-wider text-[11px] cursor-pointer transition-colors ${
                    active
                      ? "bg-ink text-paper font-semibold"
                      : "bg-paper text-ink-soft hover:text-ink border border-rule"
                  }`}
                >
                  {statusKey}
                </button>
              );
            }
          )}
        </div>

        {/* Confidence slider */}
        <div className="flex items-center gap-2 border-r border-rule pr-3">
          <label
            htmlFor={minConfidenceId}
            className="text-[11px] uppercase tracking-wider text-ink-soft whitespace-nowrap"
          >
            Min Confidence:
          </label>
          <input
            id={minConfidenceId}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filters.minConfidence}
            onChange={handleConfidenceChange}
            aria-label="Minimum confidence"
            className="w-20 accent-signal cursor-pointer"
          />
          <span className="w-9 text-[11px] tabular-nums text-ink font-medium">
            {Math.round(filters.minConfidence * 100)}%
          </span>
        </div>

        {/* Source Domain select */}
        <div className="flex items-center gap-1.5 border-r border-rule pr-3">
          <label
            htmlFor={domainSelectId}
            className="text-[11px] uppercase tracking-wider text-ink-soft whitespace-nowrap"
          >
            Domain:
          </label>
          <select
            id={domainSelectId}
            value={filters.sourceDomain}
            onChange={handleDomainChange}
            aria-label="Source domain"
            className="bg-paper border border-rule rounded-xs px-2 py-1 text-xs text-ink cursor-pointer focus:outline-none focus:border-signal"
          >
            <option value="">All Domains</option>
            {domains.map((dom) => (
              <option key={dom} value={dom}>
                {dom}
              </option>
            ))}
          </select>
        </div>

        {/* Field presence select */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={fieldSelectId}
            className="text-[11px] uppercase tracking-wider text-ink-soft whitespace-nowrap"
          >
            Field Presence:
          </label>
          <select
            id={fieldSelectId}
            value={filters.fieldPresence}
            onChange={handleFieldPresenceChange}
            aria-label="Field presence"
            className="bg-paper border border-rule rounded-xs px-2 py-1 text-xs text-ink cursor-pointer focus:outline-none focus:border-signal"
          >
            <option value="">All Fields</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto text-ink hover:text-signal underline text-[11px] uppercase tracking-wider cursor-pointer font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet
        open={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title="Filter Ledger Records"
      >
        <div className="space-y-5 p-4 font-mono text-xs">
          {/* Status section */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Verification Status
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["all", "verified", "unverified", "contradicted"] as const).map(
                (statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => handleStatusChange(statusKey)}
                    className={`py-2 px-3 rounded-xs uppercase tracking-wider text-xs border text-center cursor-pointer transition-colors ${
                      filters.status === statusKey
                        ? "bg-ink text-paper border-ink font-semibold"
                        : "bg-paper text-ink border-rule hover:border-signal"
                    }`}
                  >
                    {statusKey}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Min confidence section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor={`mobile-${minConfidenceId}`}
                className="text-[11px] uppercase tracking-wider text-ink-soft font-semibold"
              >
                Minimum Confidence
              </label>
              <span className="text-ink font-semibold tabular-nums">
                {Math.round(filters.minConfidence * 100)}%
              </span>
            </div>
            <input
              id={`mobile-${minConfidenceId}`}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filters.minConfidence}
              onChange={handleConfidenceChange}
              aria-label="Minimum confidence"
              className="w-full accent-signal cursor-pointer h-6"
            />
          </div>

          {/* Domain section */}
          <div className="space-y-2">
            <label
              htmlFor={`mobile-${domainSelectId}`}
              className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold"
            >
              Source Domain
            </label>
            <select
              id={`mobile-${domainSelectId}`}
              value={filters.sourceDomain}
              onChange={handleDomainChange}
              aria-label="Source domain"
              className="w-full bg-paper border border-rule rounded-xs p-2 text-xs text-ink cursor-pointer focus:outline-none focus:border-signal"
            >
              <option value="">All Domains</option>
              {domains.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          </div>

          {/* Field presence section */}
          <div className="space-y-2">
            <label
              htmlFor={`mobile-${fieldSelectId}`}
              className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold"
            >
              Field Presence
            </label>
            <select
              id={`mobile-${fieldSelectId}`}
              value={filters.fieldPresence}
              onChange={handleFieldPresenceChange}
              aria-label="Field presence"
              className="w-full bg-paper border border-rule rounded-xs p-2 text-xs text-ink cursor-pointer focus:outline-none focus:border-signal"
            >
              <option value="">All Fields</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex gap-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => setIsMobileSheetOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
