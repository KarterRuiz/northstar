"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { Role } from "@/config/roles";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  assignAdditionalTeacherAction,
  assignHomeroomTeacherAction,
  createClassAction,
  type ClassManagementMutationState,
} from "./class-management-actions";
import { ClassManagementClassesOverview } from "./class-management-classes-overview";
import { NewClassDialog } from "./new-class-dialog";
import { CLASS_TEACHER_EXTRA_ROLES, CLASS_TEACHER_ROLE_HOMEROOM } from "./constants";
import type {
  ClassManagementAppliedFilters,
  ClassManagementClassRow,
  ClassManagementGradeFilterOption,
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "./load-class-management-data";

function MutationBanner({ state }: { state: ClassManagementMutationState | undefined }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  return (
    <p className="text-primary text-sm" role="status">
      {state.message ?? "Saved."}
    </p>
  );
}

export function ClassManagementForms({
  dashboardRole,
  schoolYears,
  gradeLevels,
  classes,
  allClasses,
  teachers,
  gradeFilterOptions,
  appliedFilters,
  totalClassCount,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  /** Filtered list for the overview table and summary metrics. */
  classes: ClassManagementClassRow[];
  /** Complete roster for teacher-assignment pickers (ignores URL filters). */
  allClasses: ClassManagementClassRow[];
  teachers: TeacherOption[];
  gradeFilterOptions: ClassManagementGradeFilterOption[];
  appliedFilters: ClassManagementAppliedFilters;
  totalClassCount: number;
}) {
  const [clState, clAction, clPending] = useActionState(createClassAction, undefined);
  const [hrState, hrAction, hrPending] = useActionState(assignHomeroomTeacherAction, undefined);
  const [adState, adAction, adPending] = useActionState(assignAdditionalTeacherAction, undefined);

  const activeClasses = allClasses.filter((c) => c.is_active);

  const settingsAcademicHref = `/dashboard/${dashboardRole}/school-settings#academic-structure`;

  return (
    <div className="space-y-10">
      {totalClassCount === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardHeader>
            <CardTitle>No classes yet</CardTitle>
            <CardDescription>
              When school years, grade levels, and teacher accounts are ready, use{" "}
              <span className="text-foreground font-medium">+ New class</span> to create your first
              class with homeroom and optional co-teachers in one submit.
            </CardDescription>
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
      ) : (
        <ClassManagementClassesOverview
          role={dashboardRole}
          classes={classes}
          teachers={teachers}
          gradeFilterOptions={gradeFilterOptions}
          appliedFilters={appliedFilters}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Create a class with homeroom and supporting teachers in one step. Years and grades live in{" "}
          <Link
            href={settingsAcademicHref}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            School settings → Academic structure
          </Link>
          . You can fine-tune assignments later with{" "}
          <span className="text-foreground font-medium">Edit teachers</span> on each row.
        </p>
        <NewClassDialog
          dashboardRole={dashboardRole}
          schoolYears={schoolYears}
          gradeLevels={gradeLevels}
          teachers={teachers}
        />
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="setup">Class setup</TabsTrigger>
          <TabsTrigger value="teachers">Teacher assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Create class (quick)</CardTitle>
              <CardDescription>
                Minimal create when you only need the class shell; use + New class above for
                homeroom and co-teachers in one step.
              </CardDescription>
            </CardHeader>
            <form action={clAction}>
              <CardContent className="grid gap-4">
                <MutationBanner state={clState} />
                {schoolYears.length === 0 || gradeLevels.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Add at least one school year and one grade level in{" "}
                    <Link
                      href={settingsAcademicHref}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      School settings → Academic structure
                    </Link>{" "}
                    before creating a class.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cl-year">School year</Label>
                        <select
                          id="cl-year"
                          name="schoolYearId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {schoolYears.map((y) => (
                            <option key={y.id} value={y.id}>
                              {y.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cl-grade">Grade level</Label>
                        <select
                          id="cl-grade"
                          name="gradeLevelId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {gradeLevels.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                              {g.code ? ` (${g.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cl-name">Class name</Label>
                        <Input id="cl-name" name="name" required placeholder="Homeroom" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cl-section">Section (optional)</Label>
                        <Input id="cl-section" name="section" placeholder="6A" />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={clPending || schoolYears.length === 0 || gradeLevels.length === 0}
                >
                  {clPending ? "Saving…" : "Create class"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-6 pt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Homeroom teacher</CardTitle>
                <CardDescription>
                  Stored as class_teachers with role{" "}
                  <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
                    {CLASS_TEACHER_ROLE_HOMEROOM}
                  </code>
                  . Replaces any existing homeroom for that class.
                </CardDescription>
              </CardHeader>
              <form action={hrAction}>
                <CardContent className="grid gap-4">
                  <MutationBanner state={hrState} />
                  {activeClasses.length === 0 || teachers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {activeClasses.length === 0
                        ? "Create an active class first."
                        : "No teacher profiles found. Add users with role teacher in Supabase."}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="hr-class">Class</Label>
                        <select
                          id="hr-class"
                          name="classId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {activeClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.schoolYearLabel} · {c.gradeLevelName} · {c.name}
                              {c.section ? ` ${c.section}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hr-teacher">Teacher</Label>
                        <select
                          id="hr-teacher"
                          name="teacherProfileId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    disabled={hrPending || activeClasses.length === 0 || teachers.length === 0}
                  >
                    {hrPending ? "Saving…" : "Assign homeroom"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional teacher</CardTitle>
                <CardDescription>
                  Co-teacher, subject, or assistant — another row in class_teachers (unique per
                  teacher per class).
                </CardDescription>
              </CardHeader>
              <form action={adAction}>
                <CardContent className="grid gap-4">
                  <MutationBanner state={adState} />
                  {activeClasses.length === 0 || teachers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {activeClasses.length === 0
                        ? "Create an active class first."
                        : "No teacher profiles found. Add users with role teacher in Supabase."}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ad-class">Class</Label>
                        <select
                          id="ad-class"
                          name="classId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {activeClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.schoolYearLabel} · {c.gradeLevelName} · {c.name}
                              {c.section ? ` ${c.section}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ad-teacher">Teacher</Label>
                        <select
                          id="ad-teacher"
                          name="teacherProfileId"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ad-role">Role</Label>
                        <select
                          id="ad-role"
                          name="assignmentRole"
                          required
                          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {CLASS_TEACHER_EXTRA_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    disabled={adPending || activeClasses.length === 0 || teachers.length === 0}
                  >
                    {adPending ? "Saving…" : "Assign teacher"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
