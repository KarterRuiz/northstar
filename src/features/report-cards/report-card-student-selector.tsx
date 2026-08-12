"use client";

import { useEffect, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchStudentsForReportCardAction,
  type ReportCardStudentOption,
} from "@/features/report-cards/search-students-for-report-card-action";

export type SelectedReportCardStudent = ReportCardStudentOption;

function optionMeta(student: ReportCardStudentOption): string {
  return [student.classLabel, student.gradeLabel, student.studentNumber ? `#${student.studentNumber}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function ReportCardStudentSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: SelectedReportCardStudent | null;
  onSelect: (student: SelectedReportCardStudent | null) => void;
  disabled?: boolean;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ReportCardStudentOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchStudentsForReportCardAction(trimmed).then((res) => {
        if (res.ok) {
          setHits(res.students);
          setError(null);
        } else {
          setHits([]);
          setError(res.message);
        }
        setSearching(false);
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const trimmedQuery = query.trim();
  const visibleHits = trimmedQuery.length < 2 ? [] : hits;
  const showEmpty =
    trimmedQuery.length >= 2 && !searching && !error && visibleHits.length === 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={searchId}>Student</Label>
      {selected ? (
        <div className="border-border bg-surface-muted flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-heading text-sm font-medium">{selected.name}</p>
            <p className="ns-meta mt-0.5">
              {optionMeta(selected) || "No class on file"}
            </p>
          </div>
          <button
            type="button"
            className="text-primary shrink-0 text-xs font-medium underline-offset-4 hover:underline"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <Input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, student number, or class"
            autoComplete="off"
            disabled={disabled}
          />
          {trimmedQuery.length >= 2 && searching ? (
            <p className="ns-meta">Searching…</p>
          ) : null}
          {trimmedQuery.length >= 2 && error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {visibleHits.length > 0 ? (
            <ul
              className="border-border max-h-52 overflow-auto rounded-lg border bg-card text-sm shadow-sm"
              role="listbox"
            >
              {visibleHits.map((hit) => (
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
                    <span className="text-heading block font-medium">{hit.name}</span>
                    <span className="ns-meta">{optionMeta(hit) || "No class on file"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : showEmpty ? (
            <p className="ns-meta">No students match that search.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
