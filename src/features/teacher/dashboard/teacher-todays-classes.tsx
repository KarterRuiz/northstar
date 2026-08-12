import Link from "next/link";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import type { TeacherHomeClassCard } from "./load-teacher-home";

function attendanceLabel(status: TeacherHomeClassCard["attendance"]): string {
  if (status === "complete") return "Complete";
  if (status === "not_submitted") return "Not submitted";
  return "No roster yet";
}

export function TeacherTodaysClasses({
  classes,
}: {
  classes: TeacherHomeClassCard[];
}) {
  return (
    <section
      aria-labelledby="teacher-today-heading"
      className="flex h-full flex-col space-y-2.5"
    >
      <WorkspaceSectionHeader id="teacher-today-heading" title="Today" />

      {classes.length === 0 ? (
        <ListEmptyState
          title="No classes assigned yet"
          description="When leadership assigns your classes, they will appear here for today’s teaching."
        />
      ) : (
        <ul
          className={
            classes.length === 1
              ? "grid grid-cols-1 gap-2.5"
              : "grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          }
        >
          {classes.map((cls) => (
            <li key={cls.id}>
              <Card className="h-full p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-heading text-sm font-semibold tracking-tight">
                      {cls.title}
                    </p>
                    <p className="ns-meta mt-0.5">
                      {cls.studentCount}{" "}
                      {cls.studentCount === 1 ? "student" : "students"}
                      {" · "}
                      {cls.roleLabel}
                    </p>
                  </div>
                </div>
                {cls.attendance !== "not_required" ? (
                  <p className="ns-body mt-2.5">
                    Attendance · {attendanceLabel(cls.attendance)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={cls.classHref}>Open Class</Link>
                  </Button>
                  {cls.attendance === "not_submitted" ? (
                    <Button asChild size="sm">
                      <Link href={cls.attendanceHref}>Take Attendance</Link>
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {classes.length > 0 &&
      classes.every(
        (cls) =>
          cls.attendance === "complete" || cls.attendance === "not_required",
      ) &&
      classes.some((cls) => cls.attendance === "complete") ? (
        <p role="status" className="text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
          <span className="ns-body">Everything looks good right now.</span>
        </p>
      ) : null}
    </section>
  );
}
