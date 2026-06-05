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
import {
  createGradeLevelAction,
  createSchoolYearAction,
  type ClassManagementMutationState,
} from "@/features/classes/class-management-actions";
import type { GradeLevelRow, SchoolYearRow } from "@/features/classes/load-class-management-data";

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

export function AcademicStructureForms({
  dashboardRole,
  schoolYears,
  gradeLevels,
}: {
  dashboardRole: Role;
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
}) {
  const [syState, syAction, syPending] = useActionState(createSchoolYearAction, undefined);
  const [glState, glAction, glPending] = useActionState(createGradeLevelAction, undefined);

  return (
    <div id="academic-structure" className="scroll-mt-24 space-y-6">
      <div className="border-border border-b pb-2">
        <h2 className="text-lg font-semibold tracking-tight">Academic structure</h2>
        <p className="text-muted-foreground text-sm">
          School years and grade levels are shared across the school. Create them here; use{" "}
          <Link
            href={`/dashboard/${dashboardRole}/classes`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Classes
          </Link>{" "}
          to build sections and assign teachers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School years</CardTitle>
            <CardDescription>Add a row in school_years (label must be unique).</CardDescription>
          </CardHeader>
          <form action={syAction}>
            <CardContent className="grid gap-4">
              <MutationBanner state={syState} />
              <div className="space-y-2">
                <Label htmlFor="ac-sy-label">Label</Label>
                <Input id="ac-sy-label" name="label" required placeholder="2026–2027" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ac-sy-start">Starts on</Label>
                  <Input id="ac-sy-start" name="startsOn" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-sy-end">Ends on</Label>
                  <Input id="ac-sy-end" name="endsOn" type="date" required />
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
            <CardTitle>Grade levels</CardTitle>
            <CardDescription>
              Name and sort order must be unique across grade_levels.
            </CardDescription>
          </CardHeader>
          <form action={glAction}>
            <CardContent className="grid gap-4">
              <MutationBanner state={glState} />
              <div className="space-y-2">
                <Label htmlFor="ac-gl-name">Name</Label>
                <Input id="ac-gl-name" name="name" required placeholder="Grade 8" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ac-gl-sort">Sort order</Label>
                  <Input
                    id="ac-gl-sort"
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={999}
                    required
                    defaultValue={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac-gl-code">Code (optional)</Label>
                  <Input id="ac-gl-code" name="code" placeholder="G8" />
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
          <CardTitle>Current school years</CardTitle>
          <CardDescription>Existing rows (newest start date first).</CardDescription>
        </CardHeader>
        <CardContent>
          {schoolYears.length === 0 ? (
            <p className="text-muted-foreground text-sm">No school years yet.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-md border text-sm">
              {schoolYears.map((y) => (
                <li key={y.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{y.label}</span>
                  <span className="text-muted-foreground">
                    {y.starts_on} → {y.ends_on}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current grade levels</CardTitle>
          <CardDescription>Sorted by sort order, then name.</CardDescription>
        </CardHeader>
        <CardContent>
          {gradeLevels.length === 0 ? (
            <p className="text-muted-foreground text-sm">No grade levels yet.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-md border text-sm">
              {gradeLevels.map((g) => (
                <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="font-medium">
                    {g.name}
                    {g.code ? ` (${g.code})` : ""}
                  </span>
                  <span className="text-muted-foreground">Order {g.sort_order}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
