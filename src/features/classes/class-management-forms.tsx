"use client";

import Link from "next/link";

import type { Role } from "@/config/roles";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ClassManagementClassesOverview } from "./class-management-classes-overview";
import { NewClassDialog } from "./new-class-dialog";
import type {
  ClassManagementAppliedFilters,
  ClassManagementClassRow,
  ClassManagementGradeFilterOption,
  ClassManagementOperationalSummary,
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "./load-class-management-data";

export function ClassManagementForms({
  dashboardRole,
  schoolYears,
  gradeLevels,
  classes,
  teachers,
  gradeFilterOptions,
  appliedFilters,
  totalClassCount,
  operationalSummary,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  /** Filtered list for the overview table. */
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
  gradeFilterOptions: ClassManagementGradeFilterOption[];
  appliedFilters: ClassManagementAppliedFilters;
  totalClassCount: number;
  operationalSummary: ClassManagementOperationalSummary;
}) {
  const settingsAcademicHref = `/dashboard/${dashboardRole}/school-settings#academic-structure`;

  const newClassDialog = (
    <NewClassDialog
      dashboardRole={dashboardRole}
      schoolYears={schoolYears}
      gradeLevels={gradeLevels}
      teachers={teachers}
    />
  );

  if (totalClassCount === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>No classes yet</CardTitle>
            <CardDescription>
              When school years, grade levels, and teacher accounts are ready, use{" "}
              <span className="text-foreground font-medium">+ New class</span> to create your first
              class with a homeroom teacher and optional co-teachers.
            </CardDescription>
          </div>
          {newClassDialog}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Open{" "}
            <Link
              href={settingsAcademicHref}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              School settings → Academic structure
            </Link>{" "}
            to add years and grades if you have not already.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ClassManagementClassesOverview
      role={dashboardRole}
      classes={classes}
      teachers={teachers}
      schoolYears={schoolYears}
      gradeLevels={gradeLevels}
      gradeFilterOptions={gradeFilterOptions}
      appliedFilters={appliedFilters}
      operationalSummary={operationalSummary}
      headerAction={newClassDialog}
    />
  );
}
