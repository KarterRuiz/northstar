"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
  CLASS_SUPPORT_CATEGORY_LABEL,
  CLASS_SUPPORT_FILTERS,
  checkInSummaryLabel,
  classSupportFiltersPresent,
  classSupportFiltersUseful,
  filterClassSupport,
  type ClassSupportFilter,
} from "./class-support";
import type { ClassSupportStudent } from "./load-teacher-class-support";

export function ClassSupportList({
  students,
  positiveNoteCount,
}: {
  students: ClassSupportStudent[];
  positiveNoteCount: number;
}) {
  const [filter, setFilter] = useState<ClassSupportFilter>("all");
  const available = useMemo(
    () => classSupportFiltersPresent(students),
    [students],
  );
  const showFilters = classSupportFiltersUseful(students);
  const activeFilter = available.includes(filter) ? filter : "all";
  const visible = useMemo(
    () => filterClassSupport(students, activeFilter),
    [students, activeFilter],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-heading text-base font-semibold tracking-tight">Support</h2>
        <p className="ns-meta">{checkInSummaryLabel(students.length)}</p>
      </div>

      {showFilters ? (
        <div
          role="group"
          aria-label="Filter students to check in on"
          className="flex flex-wrap gap-1"
        >
          {CLASS_SUPPORT_FILTERS.filter((option) => available.includes(option.id)).map(
            (option) => {
              const active = activeFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    "focus-visible:ring-ring min-h-11 rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none lg:min-h-8",
                    active
                      ? "bg-heading text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-heading",
                  )}
                >
                  {option.label}
                </button>
              );
            },
          )}
        </div>
      ) : null}

      <Card className="p-3.5 sm:p-4">
        {students.length === 0 ? (
          <div role="status" className="text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <p className="ns-body">No students need follow-up right now.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="ns-body text-muted-foreground" role="status">
            No students in this view.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((student) => (
              <li key={student.studentId}>
                <div className="hover:bg-row-hover -mx-1.5 flex flex-col gap-2 rounded-lg px-1.5 py-2 transition-colors duration-150 ease-out sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="text-heading block truncate text-sm font-medium">
                      {student.displayName}
                    </span>
                    <span className="ns-meta">{student.detail}</span>
                  </span>
                  <span className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                      {CLASS_SUPPORT_CATEGORY_LABEL[student.category]}
                    </span>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-h-11 lg:min-h-8"
                    >
                      <Link href={student.href}>Open</Link>
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {positiveNoteCount > 0 ? (
          <p className="ns-meta mt-3">
            Positive notes · {positiveNoteCount} recently
          </p>
        ) : null}
      </Card>
    </div>
  );
}
