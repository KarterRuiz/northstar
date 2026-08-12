"use client";

import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  searchFollowUpClassesAction,
  searchFollowUpParentRequestsAction,
  searchFollowUpStaffAction,
  searchFollowUpStudentsAction,
  type FollowUpSearchOption,
} from "./search-related-actions";

export type RelatedKind = "none" | "student" | "staff" | "class" | "parent_request";

export type RelatedSelection = {
  kind: RelatedKind;
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
  selected: FollowUpSearchOption | null;
  onSelect: (option: FollowUpSearchOption | null) => void;
  disabled?: boolean;
  search: (q: string) => Promise<
    | { ok: true; options: FollowUpSearchOption[] }
    | { ok: false; message: string }
  >;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FollowUpSearchOption[]>([]);
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
      {trimmed.length >= 2 && searching ? <p className="ns-meta">Searching…</p> : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="border-border max-h-44 overflow-auto rounded-lg border bg-card text-sm shadow-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="hover:bg-row-hover w-full px-3 py-2 text-left transition-colors"
                onClick={() => {
                  onSelect(hit);
                  setQuery("");
                  setHits([]);
                }}
              >
                <span className="text-heading block font-medium">{hit.label}</span>
                {hit.meta ? <span className="ns-meta">{hit.meta}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : trimmed.length >= 2 && !searching && !error ? (
        <p className="ns-meta">No matches.</p>
      ) : null}
    </div>
  );
}

export function FollowUpRelatedFields({
  value,
  onChange,
  disabled,
}: {
  value: RelatedSelection;
  onChange: (next: RelatedSelection) => void;
  disabled?: boolean;
}) {
  const selected: FollowUpSearchOption | null =
    value.id && value.label ? { id: value.id, label: value.label } : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="follow-up-related">Related to</Label>
        <select
          id="follow-up-related"
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-xs"
          value={value.kind}
          disabled={disabled}
          onChange={(e) =>
            onChange({ kind: e.target.value as RelatedKind, id: null, label: null })
          }
        >
          <option value="none">None — just a reminder</option>
          <option value="student">Student</option>
          <option value="staff">Staff</option>
          <option value="class">Class</option>
          <option value="parent_request">Parent request</option>
        </select>
      </div>

      {value.kind === "student" ? (
        <SearchPicker
          label="Student"
          placeholder="Search name or student number"
          selected={selected}
          disabled={disabled}
          search={searchFollowUpStudentsAction}
          onSelect={(opt) =>
            onChange({ kind: "student", id: opt?.id ?? null, label: opt?.label ?? null })
          }
        />
      ) : null}
      {value.kind === "staff" ? (
        <SearchPicker
          label="Staff"
          placeholder="Search staff name or email"
          selected={selected}
          disabled={disabled}
          search={searchFollowUpStaffAction}
          onSelect={(opt) =>
            onChange({ kind: "staff", id: opt?.id ?? null, label: opt?.label ?? null })
          }
        />
      ) : null}
      {value.kind === "class" ? (
        <SearchPicker
          label="Class"
          placeholder="Search class name"
          selected={selected}
          disabled={disabled}
          search={searchFollowUpClassesAction}
          onSelect={(opt) =>
            onChange({ kind: "class", id: opt?.id ?? null, label: opt?.label ?? null })
          }
        />
      ) : null}
      {value.kind === "parent_request" ? (
        <SearchPicker
          label="Parent request"
          placeholder="Search requester name"
          selected={selected}
          disabled={disabled}
          search={searchFollowUpParentRequestsAction}
          onSelect={(opt) =>
            onChange({
              kind: "parent_request",
              id: opt?.id ?? null,
              label: opt?.label ?? null,
            })
          }
        />
      ) : null}
    </div>
  );
}

export function relatedKindFromPrefill(args: {
  studentId?: string;
  staffMemberId?: string;
  classId?: string;
  parentRequestId?: string;
}): RelatedSelection {
  if (args.studentId) {
    return { kind: "student", id: args.studentId, label: null };
  }
  if (args.staffMemberId) {
    return { kind: "staff", id: args.staffMemberId, label: null };
  }
  if (args.classId) {
    return { kind: "class", id: args.classId, label: null };
  }
  if (args.parentRequestId) {
    return { kind: "parent_request", id: args.parentRequestId, label: null };
  }
  return { kind: "none", id: null, label: null };
}
