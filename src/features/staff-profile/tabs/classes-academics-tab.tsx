import Link from "next/link";
import { GraduationCap } from "lucide-react";

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
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import { STAFF_GRADEBOOK_LEADERSHIP_ACCESS } from "@/features/staff-profile/architecture-notes";
import type { StaffClassAcademicRow } from "@/features/staff-profile/load-staff-leadership-metrics";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";

import { StaffAssignmentManageButtons } from "./assignment-manage-buttons";

type StaffClassesAcademicsTabProps = {
  staffMemberId: string;
  staffName: string;
  role: string;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  classAcademics: StaffClassAcademicRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
};

export function StaffClassesAcademicsTab({
  staffMemberId,
  staffName,
  role,
  grades,
  classes,
  classAcademics,
  availableGrades,
  availableClasses,
}: StaffClassesAcademicsTabProps) {
  if (role !== "teacher") {
    return (
      <ProfileEmptyState
        icon={GraduationCap}
        title="No teaching assignment"
        description="Classes and academics apply to teacher roles. Leadership and registrar roles do not use class rosters here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Classes &amp; academics</h2>
          <p className="ns-muted">
            Academic work connected to the classes this teacher teaches — not personal
            grades. Gradebooks stay on class routes; leadership reviews completion here.
          </p>
        </div>
        <StaffAssignmentManageButtons
          staffMemberId={staffMemberId}
          staffName={staffName}
          grades={grades}
          classes={classes}
          availableGrades={availableGrades}
          availableClasses={availableClasses}
        />
      </div>

      <Card variant="muted">
        <CardHeader>
          <CardTitle className="ns-card-title">Grade / program</CardTitle>
          <CardDescription>Program access for this teacher.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-foreground text-sm font-medium leading-relaxed">
            {formatStaffAssignedGradesSummary(grades)}
          </p>
          {grades.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {grades.map((g) => (
                <li key={g.id} className="text-muted-foreground">
                  {g.gradeName}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {classAcademics.length === 0 ? (
        <ProfileEmptyState
          icon={GraduationCap}
          title="No classes assigned"
          description="Assign classes from Manage assignments to show roster size, attendance responsibility, and report-card links."
        />
      ) : (
        <Card variant="table">
          <CardHeader>
            <CardTitle className="ns-card-title">Assigned classes</CardTitle>
            <CardDescription>
              Open class management or report-card coverage. {STAFF_GRADEBOOK_LEADERSHIP_ACCESS}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>School year</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead>Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classAcademics.map((c) => (
                  <TableRow key={c.classId}>
                    <TableCell className="ns-table-primary">
                      <div>
                        {c.className}
                        {c.section ? ` · ${c.section}` : ""}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {c.gradeName}
                        {!c.classIsActive ? " · Archived" : null}
                      </div>
                    </TableCell>
                    <TableCell>{c.assignmentRoleLabel}</TableCell>
                    <TableCell>{c.schoolYearLabel || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.studentCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        <Link
                          href={c.classHref}
                          className="text-primary font-medium hover:underline"
                        >
                          Open class
                        </Link>
                        <Link
                          href={c.reportCardsHref}
                          className="text-primary font-medium hover:underline"
                        >
                          Report cards
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
