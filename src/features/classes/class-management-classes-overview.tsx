"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ClassesOverviewTable } from "./classes-overview-table";
import type {
  ClassManagementAppliedFilters,
  ClassManagementClassRow,
  ClassManagementGradeFilterOption,
  TeacherOption,
} from "./load-class-management-data";

function buildClassesHref(
  basePath: string,
  next: ClassManagementAppliedFilters,
): string {
  const sp = new URLSearchParams();
  if (next.q.trim()) sp.set("q", next.q.trim());
  if (next.status !== "all") sp.set("status", next.status);
  if (next.gradeLevelId) sp.set("grade", next.gradeLevelId);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function ClassesSearchInput({
  appliedQ,
  pending,
  onDebouncedChange,
}: {
  appliedQ: string;
  pending: boolean;
  onDebouncedChange: (q: string) => void;
}) {
  const [value, setValue] = useState(appliedQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = next.trim().slice(0, 200);
      if (trimmed === appliedQ) return;
      onDebouncedChange(trimmed);
    }, 350);
  };

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label htmlFor="classes-search">Search</Label>
      <Input
        id="classes-search"
        name="q"
        placeholder="Class, teacher, or grade…"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <p className="text-muted-foreground text-xs">
        Matches class name, section, grade label, and assigned teachers.
      </p>
    </div>
  );
}

export function ClassManagementClassesOverview({
  role,
  classes,
  teachers,
  gradeFilterOptions,
  appliedFilters,
}: {
  role: string;
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
  gradeFilterOptions: ClassManagementGradeFilterOption[];
  appliedFilters: ClassManagementAppliedFilters;
}) {
  const router = useRouter();
  const currentSearch = useSearchParams();
  const [pending, startTransition] = useTransition();

  const basePath = `/dashboard/${role}/classes`;

  const metrics = useMemo(() => {
    const teacherIds = new Set<string>();
    for (const c of classes) {
      for (const t of c.teachers) {
        teacherIds.add(t.teacherProfileId);
      }
    }
    const archivedInView = classes.filter((c) => !c.is_active).length;
    const totalStudents = classes.reduce((sum, c) => sum + c.studentEnrollmentCount, 0);
    return {
      totalClasses: classes.length,
      totalTeachers: teacherIds.size,
      totalStudents,
      archivedInView,
    };
  }, [classes]);

  const navigateFilters = useCallback(
    (next: ClassManagementAppliedFilters) => {
      const href = buildClassesHref(basePath, next);
      startTransition(() => {
        router.replace(href);
      });
    },
    [basePath, router],
  );

  const onStatusChange = (value: string) => {
    const status =
      value === "active" || value === "archived" ? value : ("all" as const);
    navigateFilters({ ...appliedFilters, status });
  };

  const onGradeChange = (value: string) => {
    const gradeLevelId = value && value !== "all" ? value : null;
    navigateFilters({ ...appliedFilters, gradeLevelId });
  };

  const filterSummary =
    "Totals match the filtered table (search, status, and grade filters).";

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-xs">{filterSummary}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Classes</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {metrics.totalClasses}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Rows in the table below
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teachers</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {metrics.totalTeachers}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Unique staff assigned to these classes
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {metrics.totalStudents}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Sum of active enrollments in these classes
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Archived in view</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {metrics.archivedInView}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Inactive classes among filtered results
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-border space-y-1 border-b bg-muted/30 pb-4">
          <CardTitle className="text-xl">Classes overview</CardTitle>
          <CardDescription>
            Active enrollments, homeroom and supporting teachers, and roster status. Use filters to
            focus the list; use <span className="text-foreground font-medium">Edit teachers</span>{" "}
            on a row to manage assignments. Archive and delete behave as before.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <ClassesSearchInput
              key={`q-${appliedFilters.q}`}
              appliedQ={appliedFilters.q}
              pending={pending}
              onDebouncedChange={(q) => navigateFilters({ ...appliedFilters, q })}
            />
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto lg:min-w-[20rem]">
              <div className="space-y-2">
                <Label htmlFor="classes-status">Status</Label>
                <select
                  id="classes-status"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                  value={appliedFilters.status}
                  disabled={pending}
                  onChange={(e) => onStatusChange(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="classes-grade">Grade level</Label>
                <select
                  id="classes-grade"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                  value={appliedFilters.gradeLevelId ?? "all"}
                  disabled={pending}
                  onChange={(e) => onGradeChange(e.target.value)}
                >
                  <option value="all">All grades</option>
                  {gradeFilterOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {currentSearch.toString() ? (
            <p className="text-muted-foreground text-xs">
              <button
                type="button"
                className="text-primary font-medium underline-offset-4 hover:underline"
                disabled={pending}
                onClick={() => navigateFilters({ q: "", status: "all", gradeLevelId: null })}
              >
                Clear filters
              </button>
            </p>
          ) : null}

          {classes.length === 0 ? (
            <p className="text-muted-foreground border-muted rounded-md border border-dashed px-4 py-10 text-center text-sm">
              No classes match these filters. Try clearing search or widening status and grade.
            </p>
          ) : (
            <ClassesOverviewTable classes={classes} teachers={teachers} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
