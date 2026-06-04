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
  teacherUpdateStudentAction,
  type TeacherStudentMutationState,
} from "./teacher-student-actions";

const NAME_MAX = 120;

type TeacherEditStudentFormProps = {
  studentId: string;
  initialFirstName: string;
  initialLastName: string;
  initialPreferredName: string;
  profileHref: string;
};

export function TeacherEditStudentForm({
  studentId,
  initialFirstName,
  initialLastName,
  initialPreferredName,
  profileHref,
}: TeacherEditStudentFormProps) {
  const [state, formAction, pending] = useActionState<
    TeacherStudentMutationState | undefined,
    FormData
  >(teacherUpdateStudentAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />

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
          <div className="mt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={profileHref}>Back to profile</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name</CardTitle>
          <CardDescription>
            Update how this student appears on your class rosters. Class placement and
            student numbers are managed by registrars.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-edit-first">First name</Label>
            <Input
              id="teacher-edit-first"
              name="firstName"
              required
              defaultValue={initialFirstName}
              maxLength={NAME_MAX}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-edit-last">Last name</Label>
            <Input
              id="teacher-edit-last"
              name="lastName"
              required
              defaultValue={initialLastName}
              maxLength={NAME_MAX}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="teacher-edit-preferred">
              Preferred name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="teacher-edit-preferred"
              name="preferredName"
              defaultValue={initialPreferredName}
              maxLength={NAME_MAX}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="outline" type="button" asChild>
          <Link href={profileHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
