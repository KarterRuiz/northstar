import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { ListEmptyState } from "@/components/workspace/list-empty-state";

import { loadClassDataCenterAttendance } from "./load-class-data-center-attendance";

export async function ClassDataCenterAttendanceTab({
  classId,
  attendanceDate,
}: {
  classId: string;
  attendanceDate: string | null;
}) {
  const data = await loadClassDataCenterAttendance(classId, attendanceDate);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load attendance.</span> {data.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceSectionHeader
          title="Attendance review"
          description={`${data.attendanceDate} · ${data.studentCountLabel} · ${data.completionLabel}`}
        />
        {data.openAttendanceHref && data.isActive ? (
          <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
            <Link href={data.openAttendanceHref}>Open attendance</Link>
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden p-0">
        {data.roster.length === 0 ? (
          <div className="p-4">
            <ListEmptyState
              title="No students to review"
              description="When students are enrolled, today’s attendance snapshot appears here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.roster.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell>
                      <Link
                        href={row.href}
                        className="text-primary font-medium underline-offset-4 hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {row.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{row.statusLabel}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.notes?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {data.history.length > 0 ? (
        <section className="space-y-2.5" aria-labelledby="cdc-att-history">
          <WorkspaceSectionHeader id="cdc-att-history" title="Recent history" />
          <Card className="p-3.5 sm:p-4">
            <ul className="space-y-2 text-sm">
              {data.history.map((row) => (
                <li key={row.date} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-heading font-medium">{row.dateLabel}</span>
                  <span className="text-muted-foreground">
                    {row.statusLabel}
                    <span className="sr-only">
                      {" "}
                      ({row.markedCount} marked)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
