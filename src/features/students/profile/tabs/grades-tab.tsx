import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/config/roles";

import { getStudentGrades } from "../data";
import { ProfileEmptyState } from "../profile-empty-state";
import { StudentGradebookSummary } from "../student-gradebook-summary";

const CARD_CHROME = "border-border/70 shadow-sm";
const TH = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

type GradesTabProps = {
  studentId: string;
  role: Role;
};

export async function GradesTab({ studentId, role }: GradesTabProps) {
  const rows = await getStudentGrades(studentId);

  return (
    <div className="space-y-5">
      <StudentGradebookSummary studentId={studentId} role={role} />

      <Card className={CARD_CHROME}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base">Structured academic records</CardTitle>
            <CardDescription>
              Teacher-entered subject records (separate from the class gradebook grid).
            </CardDescription>
          </div>
          {role === "teacher" ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link
                href={`/dashboard/teacher/academic-records/new?studentId=${encodeURIComponent(studentId)}`}
              >
                Add record
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <ProfileEmptyState
              icon={GraduationCap}
              title="No academic records on file"
              description={
                <>
                  When teachers submit structured records for this learner, they appear
                  here with subject, term, and score or grade.
                </>
              }
            />
          ) : (
            <>
              <p className="text-muted-foreground sm:hidden text-xs leading-relaxed">
                Swipe horizontally to see all columns.
              </p>
              <Table aria-label="Student academic records">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TH}>Subject</TableHead>
                    <TableHead className={TH}>Class</TableHead>
                    <TableHead className={TH}>Term</TableHead>
                    <TableHead className={TH}>Score</TableHead>
                    <TableHead className={`${TH} hidden sm:table-cell`}>Status</TableHead>
                    <TableHead className={`${TH} hidden md:table-cell`}>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.courseTitle}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.courseCode}
                      </TableCell>
                      <TableCell>{row.term}</TableCell>
                      <TableCell>{row.grade}</TableCell>
                      <TableCell className="hidden capitalize sm:table-cell">
                        {row.status}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {row.updatedAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
