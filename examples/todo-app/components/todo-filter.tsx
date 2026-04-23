"use client";

import { FILTERS, FILTER_LABELS, type Filter } from "@/lib/types";

type Props = {
  value: Filter;
  onChange: (next: Filter) => void;
};

export function TodoFilter({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="필터"
      className="mb-4 inline-flex rounded-md border border-slate-200 bg-white p-1 shadow-sm"
    >
      {FILTERS.map((f) => {
        const active = value === f;
        return (
          <button
            key={f}
            type="button"
            role="tab"
            aria-pressed={active}
            aria-selected={active}
            onClick={() => onChange(f)}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        );
      })}
    </div>
  );
}
