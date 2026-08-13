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
import { matchesClassRosterSearch } from "@/features/teacher/class-workspace/class-roster";
import { studentCountLabel } from "./class-data-center-copy";
import {
  classDataCenterManageRosterHref,
  classDataCenterRosterImportHref,
} from "./constants";
import type { ClassDataCenterRosterStudent } from "./load-class-data-center-students";
import type { Role } from "@/config/roles";

type FilterId = "all" | "attention" | "records";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs Attention" },
  { id: "records", label: "Records Remaining" },
];

export function ClassDataCenterStudentsTable({
  role,
  students,
  showStudentNumber,
  canManageRoster,
}: {
  role: Role;
  students: ClassDataCenterRosterStudent[];
  showStudentNumber: boolean;
  canManageRoster: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const visible = useMemo(() => {
    return students.filter((row) => {
      if (!matchesClassRosterSearch(row.searchText, query)) return false;
      if (filter === "attention" && !row.needsSupport) return false;
      if (filter === "records" && !row.recordsRemaining) return false;
      return true;
    });
  }, [students, query, filter]);

  const showFilters =
    students.some((s) => s.needsSupport) || students.some((s) => s.recordsRemaining);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-heading text-base font-semibold tracking-tight">Students</h2>
          <p className="ns-meta">{studentCountLabel(students.length)}</p>
        </div>
        {canManageRoster ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Link href={classDataCenterManageRosterHref(role)}>Add student</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Link href={classDataCenterRosterImportHref(role)}>Import roster</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {students.length > 0 ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <label className="sr-only" htmlFor="cdc-roster-search">
            Search students
          </label>
          <Input
            id="cdc-roster-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students..."
            autoComplete="off"
            className="h-10 max-w-sm lg:h-9"
          />
          {showFilters ? (
            <div role="group" aria-label="Filter roster" className="flex flex-wrap gap-1">
              {FILTERS.map((option) => {
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
            description="Use Add student or Import roster to enroll students in this class."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border-border/80 rounded-xl border px-4 py-6 shadow-sm">
          <ListEmptyState
            title="No matching students"
            description="Try a different search or filter."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Student</TableHead>
                {showStudentNumber ? (
                  <TableHead className="whitespace-nowrap">Student Number</TableHead>
                ) : null}
                <TableHead>Attendance</TableHead>
                <TableHead>Academics</TableHead>
                <TableHead>Support</TableHead>
                <TableHead>Records</TableHead>
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
                    <div className="relative z-[2] min-w-0 font-medium">{row.displayName}</div>
                  </TableCell>
                  {showStudentNumber ? (
                    <TableCell className="text-muted-foreground relative z-[2] tabular-nums text-sm">
                      {row.studentNumber ?? "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="relative z-[2] text-sm">{row.attendanceLabel}</TableCell>
                  <TableCell className="relative z-[2] text-sm">{row.academicsLabel}</TableCell>
                  <TableCell className="relative z-[2] text-sm">{row.supportLabel}</TableCell>
                  <TableCell className="relative z-[2] text-sm">{row.recordsLabel}</TableCell>
                </DirectoryClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
