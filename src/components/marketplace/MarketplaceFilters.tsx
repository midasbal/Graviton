"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "assistant", label: "Assistant" },
  { value: "trading", label: "Trading" },
  { value: "coding", label: "Coding" },
  { value: "writing", label: "Writing" },
  { value: "research", label: "Research" },
  { value: "creative", label: "Creative" },
  { value: "defi", label: "DeFi" },
  { value: "other", label: "Other" },
];

const RATING_OPTIONS = [
  { value: 0, label: "Any Rating" },
  { value: 3, label: "3+ Stars" },
  { value: 4, label: "4+ Stars" },
  { value: 5, label: "5 Stars" },
];

export default function MarketplaceFilters() {
  const {
    categoryFilter,
    setCategoryFilter,
    ratingFilter,
    setRatingFilter,
    searchQuery,
    setSearchQuery,
  } = useAppStore();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-card/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all duration-200"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted hidden sm:block" />

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                categoryFilter === cat.value
                  ? "bg-accent text-white shadow-sm shadow-accent/25"
                  : "bg-card/40 text-muted border border-border/60 hover:text-foreground hover:border-accent/30"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Rating dropdown */}
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(Number(e.target.value))}
          className="rounded-xl border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted focus:border-accent/50 focus:outline-none transition-colors"
        >
          {RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
