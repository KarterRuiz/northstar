import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatStaffAssignedClassesSummary } from "@/features/admin/staff-directory/format-assigned-classes-summary";
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";
import { GraduationCap } from "lucide-react";

import { StaffAssignmentManageButtons } from "./assignment-manage-buttons";

type StaffAssignmentTabProps = {
  staffMemberId: string;
  staffName: string;
  role: string;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
};

export function StaffAssignmentTab({
  staffMemberId,
  staffName,
  role,
  grades,
  classes,
  availableGrades,
  availableClasses,
}: StaffAssignmentTabProps) {
  if (role !== "teacher") {
    return (
      <ProfileEmptyState
        icon={GraduationCap}
        title="No teaching assignment"
        description="Grade and class management applies to teacher roles. Leadership and registrar roles do not use class rosters here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="ns-section-title">Assignment</h2>
          <p className="ns-muted">
            Same grade/class architecture as the staff directory — manage here without
            duplicating tables.
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Grade levels</CardTitle>
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

        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Classes</CardTitle>
            <CardDescription>Class access for this teacher.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-sm font-medium leading-relaxed">
              {formatStaffAssignedClassesSummary(classes)}
            </p>
            {classes.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {classes.map((c) => (
                  <li key={c.assignmentId} className="text-muted-foreground">
                    {c.className}
                    {c.section ? ` · ${c.section}` : ""}
                    {c.schoolYearLabel ? ` · ${c.schoolYearLabel}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
