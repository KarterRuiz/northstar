"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { Role } from "@/config/roles";
import {
  buildClassesHref,
  type ClassManagementAppliedFilters,
  type ClassManagementStatusFilter,
} from "./class-management-filters";
import { ClassesOverviewTable } from "./classes-overview-table";
import type {
  ClassManagementClassRow,
  ClassManagementGradeFilterOption,
  ClassManagementOperationalSummary,
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "./load-class-management-data";

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
        Matches class name, section, grade, and assigned teachers.
      </p>
    </div>
  );
}

export function ClassManagementClassesOverview({
  role,
  classes,
  teachers,
  schoolYears,
  gradeLevels,
  gradeFilterOptions,
  appliedFilters,
  operationalSummary,
  headerAction,
}: {
  role: Role;
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  gradeFilterOptions: ClassManagementGradeFilterOption[];
  appliedFilters: ClassManagementAppliedFilters;
  operationalSummary: ClassManagementOperationalSummary;
  headerAction?: ReactNode;
}) {
  const router = useRouter();
  const currentSearch = useSearchParams();
  const [pending, startTransition] = useTransition();

  const basePath = `/dashboard/${role}/classes`;
  const viewingArchive = appliedFilters.status === "archived";

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
    const status: ClassManagementStatusFilter =
      value === "archived" ? "archived" : "active";
    navigateFilters({ ...appliedFilters, status });
  };

  const onGradeChange = (value: string) => {
    const gradeLevelId = value && value !== "all" ? value : null;
    navigateFilters({ ...appliedFilters, gradeLevelId });
  };

  const hasClearableFilters =
    Boolean(appliedFilters.q.trim()) ||
    Boolean(appliedFilters.gradeLevelId) ||
    viewingArchive;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Classes</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {operationalSummary.classCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Active classes
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teachers</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {operationalSummary.teacherCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Unique staff assigned to active classes
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {operationalSummary.studentCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Active enrollments in active classes
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-border space-y-1 border-b bg-muted/30 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {viewingArchive ? "Archived classes" : "Classes overview"}
              </CardTitle>
              <CardDescription>
                {viewingArchive
                  ? "Historical classes preserved for records. Restore a class to return it to the active list."
                  : "Enrollment counts, assigned teachers, and class details. Archive a class to remove it from active views while keeping history."}
              </CardDescription>
            </div>
            {headerAction && !viewingArchive ? (
              <div className="shrink-0">{headerAction}</div>
            ) : null}
          </div>
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
                <Label htmlFor="classes-status">View</Label>
                <Tabs
                  value={appliedFilters.status}
                  onValueChange={onStatusChange}
                >
                  <TabsList className="grid h-10 w-full grid-cols-2" id="classes-status">
                    <TabsTrigger value="active" disabled={pending}>
                      Active
                    </TabsTrigger>
                    <TabsTrigger value="archived" disabled={pending}>
                      Archived
                      {operationalSummary.archivedClassCount > 0
                        ? ` (${operationalSummary.archivedClassCount})`
                        : ""}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
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

          {hasClearableFilters || currentSearch.toString() ? (
            <p className="text-muted-foreground text-xs">
              <button
                type="button"
                className="text-primary font-medium underline-offset-4 hover:underline"
                disabled={pending}
                onClick={() =>
                  navigateFilters({ q: "", status: "active", gradeLevelId: null })
                }
              >
                {viewingArchive ? "Back to active classes" : "Clear filters"}
              </button>
            </p>
          ) : null}

          {classes.length === 0 ? (
            <p className="text-muted-foreground border-muted rounded-md border border-dashed px-4 py-10 text-center text-sm">
              {viewingArchive
                ? operationalSummary.archivedClassCount === 0
                  ? "No archived classes yet."
                  : "No archived classes match these filters."
                : operationalSummary.classCount === 0 &&
                    operationalSummary.archivedClassCount > 0
                  ? "No active classes. Switch to Archived to view historical classes."
                  : "No classes match these filters. Try clearing search or widening grade."}
            </p>
          ) : (
            <ClassesOverviewTable
              classes={classes}
              teachers={teachers}
              schoolYears={schoolYears}
              gradeLevels={gradeLevels}
              emphasizeSchoolYear={viewingArchive}
              dashboardRole={role}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
