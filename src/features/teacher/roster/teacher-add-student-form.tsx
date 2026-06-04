"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  teacherCreateStudentAction,
  type TeacherStudentMutationState,
} from "./teacher-student-actions";

const NAME_MAX = 120;

type TeacherAddStudentFormProps = {
  classId: string;
  classLabel: string;
  rosterHref: string;
};

export function TeacherAddStudentForm({
  classId,
  classLabel,
  rosterHref,
}: TeacherAddStudentFormProps) {
  const [state, formAction, pending] = useActionState<
    TeacherStudentMutationState | undefined,
    FormData
  >(teacherCreateStudentAction, undefined);

  const profileHref =
    state?.ok && state.studentId
      ? `/dashboard/teacher/students/${state.studentId}/overview`
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="classId" value={classId} />

      {state && !state.ok ? (
        <p
          className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <div
          className="bg-primary/5 text-primary rounded-lg border border-primary/15 px-3 py-2 text-sm"
          role="status"
        >
          <p className="font-medium">{state.message ?? "Saved."}</p>
          {profileHref ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={profileHref}>Open student profile</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={rosterHref}>Back to roster</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student</CardTitle>
          <CardDescription>
            Adds an active enrollment to <span className="text-foreground">{classLabel}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-student-first">First name</Label>
            <Input
              id="teacher-student-first"
              name="firstName"
              required
              autoComplete="given-name"
              maxLength={NAME_MAX}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-student-last">Last name</Label>
            <Input
              id="teacher-student-last"
              name="lastName"
              required
              autoComplete="family-name"
              maxLength={NAME_MAX}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="teacher-student-preferred">
              Preferred name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="teacher-student-preferred"
              name="preferredName"
              autoComplete="nickname"
              maxLength={NAME_MAX}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="outline" type="button" asChild>
          <Link href={rosterHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add student"}
        </Button>
      </div>
    </form>
  );
}
