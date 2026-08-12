"use client";

import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  searchCalendarClassesAction,
  searchCalendarStaffAction,
  searchCalendarStudentsAction,
  type CalendarSearchOption,
} from "./search-related-actions";

export type CalendarRelatedKind = "none" | "staff" | "student" | "class";

export type CalendarRelatedSelection = {
  kind: CalendarRelatedKind;
  id: string | null;
  label: string | null;
};

function SearchPicker({
  label,
  placeholder,
  selected,
  onSelect,
  disabled,
  search,
}: {
  label: string;
  placeholder: string;
  selected: CalendarSearchOption | null;
  onSelect: (option: CalendarSearchOption | null) => void;
  disabled?: boolean;
  search: (q: string) => Promise<
    | { ok: true; options: CalendarSearchOption[] }
    | { ok: false; message: string }
  >;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CalendarSearchOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void search(trimmed).then((res) => {
        if (res.ok) {
          setHits(res.options);
          setError(null);
        } else {
          setHits([]);
          setError(res.message);
        }
        setSearching(false);
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="border-border bg-surface-muted flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-heading text-sm font-medium">{selected.label}</p>
            {selected.meta ? <p className="ns-meta mt-0.5">{selected.meta}</p> : null}
          </div>
          <button
            type="button"
            className="text-primary shrink-0 text-xs font-medium underline-offset-4 hover:underline"
            onClick={() => onSelect(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const trimmed = query.trim();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={searchId}>{label}</Label>
      <Input
        id={searchId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {searching ? <p className="ns-meta">Searching…</p> : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {trimmed.length >= 2 && !searching && hits.length === 0 && !error ? (
        <p className="ns-muted text-xs">No matches.</p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="hover:bg-row-hover w-full px-3 py-2 text-left"
                onClick={() => {
                  onSelect(hit);
                  setQuery("");
                  setHits([]);
                }}
              >
                <p className="text-heading text-sm font-medium">{hit.label}</p>
                {hit.meta ? <p className="ns-meta">{hit.meta}</p> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CalendarRelatedFields({
  value,
  onChange,
  disabled,
}: {
  value: CalendarRelatedSelection;
  onChange: (next: CalendarRelatedSelection) => void;
  disabled?: boolean;
}) {
  const selected: CalendarSearchOption | null =
    value.id && value.label ? { id: value.id, label: value.label } : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="calendar-related-kind">Related to</Label>
        <select
          id="calendar-related-kind"
          className="border-input bg-card focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
          value={value.kind}
          disabled={disabled}
          onChange={(e) => {
            const kind = e.target.value as CalendarRelatedKind;
            onChange({ kind, id: null, label: null });
          }}
        >
          <option value="none">None</option>
          <option value="staff">Staff</option>
          <option value="student">Student</option>
          <option value="class">Class</option>
        </select>
      </div>

      {value.kind === "staff" ? (
        <SearchPicker
          label="Staff member"
          placeholder="Search staff"
          selected={selected}
          disabled={disabled}
          search={searchCalendarStaffAction}
          onSelect={(option) =>
            onChange({
              kind: "staff",
              id: option?.id ?? null,
              label: option?.label ?? null,
            })
          }
        />
      ) : null}
      {value.kind === "student" ? (
        <SearchPicker
          label="Student"
          placeholder="Search students"
          selected={selected}
          disabled={disabled}
          search={searchCalendarStudentsAction}
          onSelect={(option) =>
            onChange({
              kind: "student",
              id: option?.id ?? null,
              label: option?.label ?? null,
            })
          }
        />
      ) : null}
      {value.kind === "class" ? (
        <SearchPicker
          label="Class"
          placeholder="Search classes"
          selected={selected}
          disabled={disabled}
          search={searchCalendarClassesAction}
          onSelect={(option) =>
            onChange({
              kind: "class",
              id: option?.id ?? null,
              label: option?.label ?? null,
            })
          }
        />
      ) : null}
    </div>
  );
}
