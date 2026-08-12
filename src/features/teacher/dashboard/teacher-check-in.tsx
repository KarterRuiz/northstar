import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import type { TeacherHomeCheckInStudent } from "./load-teacher-home";

export function TeacherCheckIn({
  students,
  positiveNoteCount,
}: {
  students: TeacherHomeCheckInStudent[];
  positiveNoteCount: number;
}) {
  return (
    <section
      aria-labelledby="teacher-check-in-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="teacher-check-in-heading"
        title="Students to Check In On"
        actions={
          <Link
            href="/dashboard/teacher/interventions"
            className="ns-meta hover:text-heading inline-flex min-h-11 items-center gap-1 rounded-md px-1 transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none lg:min-h-0"
          >
            View all
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      <Card className="p-3.5 sm:p-4">
        {students.length === 0 ? (
          <div role="status" className="text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <p className="ns-body">No students need follow-up today.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {students.map((student) => (
              <li key={student.studentId}>
                <Link
                  href={student.href}
                  className="hover:bg-row-hover group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-heading block truncate text-sm font-medium">
                      {student.displayName}
                    </span>
                    <span className="ns-meta">{student.detail}</span>
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {positiveNoteCount > 0 ? (
          <p className="ns-meta mt-3">
            Positive notes · {positiveNoteCount} recently
          </p>
        ) : null}
      </Card>
    </section>
  );
}
