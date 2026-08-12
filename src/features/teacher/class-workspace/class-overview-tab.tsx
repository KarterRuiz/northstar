import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import {
  classWorkspacePath,
  classWorkspaceAttendanceHref,
  classWorkspaceGradebookHref,
} from "./constants";
import { checkInPulseLabel } from "./class-workspace-copy";
import { loadTeacherClassOverview } from "./load-teacher-class-overview";

function PulseCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card
        variant="interactive"
        className="h-full min-h-[4.75rem] p-3.5 transition-colors duration-150 ease-out group-hover:border-heading group-hover:bg-heading group-hover:text-primary-foreground sm:p-4"
      >
        <p className="ns-meta transition-colors group-hover:text-primary-foreground/75">
          {label}
        </p>
        <p className="text-heading mt-1 text-sm font-semibold tracking-tight transition-colors group-hover:text-primary-foreground">
          {value}
        </p>
      </Card>
    </Link>
  );
}

export async function ClassOverviewTab({ classId }: { classId: string }) {
  const data = await loadTeacherClassOverview(classId);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load class overview.</span> {data.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="class-pulse-heading" className="space-y-2.5">
        <WorkspaceSectionHeader id="class-pulse-heading" title="Today" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <PulseCard
            label="Students"
            value={
              data.studentCount === 1 ? "1 student" : `${data.studentCount} students`
            }
            href={classWorkspacePath(classId, "students")}
          />
          <PulseCard
            label="Attendance"
            value={data.attendanceLabel}
            href={classWorkspaceAttendanceHref(classId)}
          />
          <PulseCard
            label="Gradebook"
            value="Open"
            href={classWorkspaceGradebookHref(classId)}
          />
          <PulseCard
            label="Support"
            value={checkInPulseLabel(data.checkInCount)}
            href={classWorkspacePath(classId, "support")}
          />
          <PulseCard
            label="Records"
            value={data.reportCardsLabel}
            href={classWorkspacePath(classId, "records")}
          />
        </div>
      </section>

      <section aria-labelledby="class-check-in-heading" className="space-y-2.5">
        <WorkspaceSectionHeader
          id="class-check-in-heading"
          title="Students to Check In On"
        />
        <Card className="p-3.5 sm:p-4">
          {data.checkIn.length === 0 ? (
            <div role="status" className="text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
              <p className="ns-body">No students need follow-up in this class right now.</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {data.checkIn.map((student) => (
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
        </Card>
      </section>
    </div>
  );
}
