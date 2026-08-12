"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DirectoryClickableRow,
  DirectoryRowHitTarget,
} from "@/components/workspace/directory-clickable-row";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { cn } from "@/lib/utils";

import {
  CLASS_ROSTER_FILTERS,
  filterClassRoster,
  type ClassRosterFilter,
} from "./class-roster";
import { studentCountLabel } from "./class-workspace-copy";
import type { ClassRosterStudent } from "./load-teacher-class-roster";

export function ClassRosterTable({
  students,
  showStudentNumber,
  showFilters,
  enrollment,
}: {
  students: ClassRosterStudent[];
  showStudentNumber: boolean;
  showFilters: boolean;
  enrollment: { addHref: string; bulkHref: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClassRosterFilter>("all");

  const visible = useMemo(
    () => filterClassRoster(students, { query, filter }),
    [students, query, filter],
  );

  const searching = query.trim().length > 0 || filter !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-heading text-base font-semibold tracking-tight">Students</h2>
          <p className="ns-meta">{studentCountLabel(students.length)}</p>
        </div>
        {enrollment ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Link href={enrollment.addHref}>Add student</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Link href={enrollment.bulkHref}>Bulk add</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {students.length > 0 ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <label className="sr-only" htmlFor="class-roster-search">
            Search students
          </label>
          <Input
            id="class-roster-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students..."
            autoComplete="off"
            className="h-10 max-w-sm lg:h-9"
          />
          {showFilters ? (
            <div
              role="group"
              aria-label="Filter roster"
              className="flex flex-wrap gap-1"
            >
              {CLASS_ROSTER_FILTERS.map((option) => {
                const active = filter === option.id;
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
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="bg-card border-border/80 rounded-xl border px-4 py-6 shadow-sm">
          <ListEmptyState
            title="No students in this class yet"
            description="Ask school leadership to add students to this class roster."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border-border/80 rounded-xl border px-4 py-6 shadow-sm">
          <ListEmptyState
            title="No students match"
            description={
              searching
                ? "Try a different name or student number, or clear search to see the full class."
                : "Ask school leadership to add students to this class roster."
            }
          />
        </div>
      ) : (
        <div className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
          <Table aria-label="Class roster" className="min-w-[20rem]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Student</TableHead>
                {showStudentNumber ? (
                  <TableHead scope="col" className="hidden sm:table-cell">
                    Number
                  </TableHead>
                ) : null}
                <TableHead scope="col">Support</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <DirectoryClickableRow key={row.studentId} className="min-h-11">
                  <TableCell className="py-2.5 sm:py-2">
                    <DirectoryRowHitTarget
                      href={row.href}
                      label={`Open ${row.displayName}`}
                    />
                    <div className="relative z-[2] min-w-0">
                      <p className="ns-table-primary truncate">{row.displayName}</p>
                      {showStudentNumber && row.studentNumber ? (
                        <p className="ns-meta font-mono sm:hidden">{row.studentNumber}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  {showStudentNumber ? (
                    <TableCell className="relative z-[2] hidden font-mono text-sm sm:table-cell">
                      {row.studentNumber ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell className="relative z-[2]">
                    <QuietCell
                      value={row.supportLabel}
                      emphasize={row.needsSupport}
                    />
                  </TableCell>
                </DirectoryClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function QuietCell({
  value,
  emphasize,
}: {
  value: string;
  emphasize: boolean;
}) {
  if (value === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className={cn("text-sm", emphasize ? "text-heading" : "text-muted-foreground")}>
      {value}
    </span>
  );
}
