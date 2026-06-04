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
import { Label } from "@/components/ui/label";

import {
  teacherBulkCreateStudentsAction,
  type TeacherBulkRosterState,
} from "./teacher-student-actions";

type TeacherBulkAddFormProps = {
  classId: string;
  classLabel: string;
  rosterHref: string;
};

export function TeacherBulkAddForm({
  classId,
  classLabel,
  rosterHref,
}: TeacherBulkAddFormProps) {
  const [state, formAction, pending] = useActionState<
    TeacherBulkRosterState | undefined,
    FormData
  >(teacherBulkCreateStudentsAction, undefined);

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
          <p className="font-medium">{state.message}</p>
          {state.failed.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-sm">
              {state.failed.map((f) => (
                <li key={`${f.line}-${f.message}`}>
                  Line {f.line}: {f.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={rosterHref}>Back to roster</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {state && !state.ok && state.failed && state.failed.length > 0 ? (
        <ul
          className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          role="alert"
        >
          {state.failed.map((f) => (
            <li key={`${f.line}-${f.message}`}>
              Line {f.line}: {f.message}
            </li>
          ))}
        </ul>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste roster</CardTitle>
          <CardDescription>
            One student per line for{" "}
            <span className="text-foreground">{classLabel}</span>. Comma-separated names
            work too; an optional header row is ignored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-roster-paste">Names</Label>
            <textarea
              id="teacher-roster-paste"
              name="rosterPaste"
              required
              rows={12}
              placeholder={`First Name, Last Name\nJoey, Chen\nMaya, Zhang\nAlex Rivera`}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[12rem] w-full rounded-md border px-3 py-2 font-mono text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Examples: <code className="text-foreground">Joey, Chen</code> or{" "}
            <code className="text-foreground">Maya Zhang</code>. Each row creates an active
            enrollment in this class.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="outline" type="button" asChild>
          <Link href={rosterHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add students"}
        </Button>
      </div>
    </form>
  );
}
