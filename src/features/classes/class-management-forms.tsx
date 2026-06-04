"use client";

import { useActionState } from "react";

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

import {
  assignAdditionalTeacherAction,
  assignHomeroomTeacherAction,
  createClassAction,
  createGradeLevelAction,
  createSchoolYearAction,
  type ClassManagementMutationState,
} from "./class-management-actions";
import { ClassesOverviewTable } from "./classes-overview-table";
import {
  CLASS_TEACHER_EXTRA_ROLES,
  CLASS_TEACHER_ROLE_HOMEROOM,
} from "./constants";
import type {
  ClassManagementClassRow,
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
  schoolYears,
  gradeLevels,
  classes,
  teachers,
}: {
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
}) {
  const [syState, syAction, syPending] = useActionState(createSchoolYearAction, undefined);
  const [glState, glAction, glPending] = useActionState(createGradeLevelAction, undefined);
  const [clState, clAction, clPending] = useActionState(createClassAction, undefined);
  const [hrState, hrAction, hrPending] = useActionState(assignHomeroomTeacherAction, undefined);
  const [adState, adAction, adPending] = useActionState(assignAdditionalTeacherAction, undefined);

  const activeClasses = classes.filter((c) => c.is_active);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School year</CardTitle>
            <CardDescription>Add a row in school_years (label must be unique).</CardDescription>
          </CardHeader>
          <form action={syAction}>
            <CardContent className="grid gap-4">
              <MutationBanner state={syState} />
              <div className="space-y-2">
                <Label htmlFor="sy-label">Label</Label>
                <Input id="sy-label" name="label" required placeholder="2026–2027" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sy-start">Starts on</Label>
                  <Input id="sy-start" name="startsOn" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sy-end">Ends on</Label>
                  <Input id="sy-end" name="endsOn" type="date" required />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={syPending}>
                {syPending ? "Saving…" : "Create school year"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade level</CardTitle>
            <CardDescription>
              Name and sort order must be unique across grade_levels.
            </CardDescription>
          </CardHeader>
          <form action={glAction}>
            <CardContent className="grid gap-4">
              <MutationBanner state={glState} />
              <div className="space-y-2">
                <Label htmlFor="gl-name">Name</Label>
                <Input id="gl-name" name="name" required placeholder="Grade 8" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gl-sort">Sort order</Label>
                  <Input
                    id="gl-sort"
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={999}
                    required
                    defaultValue={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gl-code">Code (optional)</Label>
                  <Input id="gl-code" name="code" placeholder="G8" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={glPending}>
                {glPending ? "Saving…" : "Create grade level"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class</CardTitle>
          <CardDescription>Links a section to a school year and grade level.</CardDescription>
        </CardHeader>
        <form action={clAction}>
          <CardContent className="grid gap-4">
            <MutationBanner state={clState} />
            {schoolYears.length === 0 || gradeLevels.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Add at least one school year and one grade level before creating a class.
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
            <Button type="submit" disabled={clPending || schoolYears.length === 0 || gradeLevels.length === 0}>
              {clPending ? "Saving…" : "Create class"}
            </Button>
          </CardFooter>
        </form>
      </Card>

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
              <Button type="submit" disabled={hrPending || activeClasses.length === 0 || teachers.length === 0}>
                {hrPending ? "Saving…" : "Assign homeroom"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional teacher</CardTitle>
            <CardDescription>
              Co-teacher, subject, or assistant — another row in class_teachers (unique per teacher per class).
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
              <Button type="submit" disabled={adPending || activeClasses.length === 0 || teachers.length === 0}>
                {adPending ? "Saving…" : "Assign teacher"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Classes overview</CardTitle>
          <CardDescription>
            Archive hides a class from teacher workflows while preserving records. Delete is only for
            empty or test classes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-muted-foreground border-muted rounded-md border border-dashed px-4 py-8 text-center text-sm">
              No classes yet. Create a school year, a grade level, then a class.
            </p>
          ) : (
            <ClassesOverviewTable classes={classes} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
