"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  StaffMemberClassesDialog,
  StaffMemberGradesDialog,
} from "@/features/admin/staff-directory/staff-member-access-dialogs";

type Props = {
  staffMemberId: string;
  staffName: string;
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  availableGrades: GradeInviteOption[];
  availableClasses: ClassInviteOption[];
};

export function StaffAssignmentManageButtons({
  staffMemberId,
  staffName,
  grades,
  classes,
  availableGrades,
  availableClasses,
}: Props) {
  const [gradesOpen, setGradesOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const gradeIds = grades.map((g) => g.gradeLevelId);

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setGradesOpen(true)}>
        Manage grades
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setClassesOpen(true)}
      >
        Manage classes
      </Button>
      <StaffMemberGradesDialog
        staffMemberId={staffMemberId}
        teacherLabel={staffName}
        assigned={grades}
        availableGrades={availableGrades}
        open={gradesOpen}
        onOpenChange={setGradesOpen}
      />
      <StaffMemberClassesDialog
        staffMemberId={staffMemberId}
        teacherLabel={staffName}
        assigned={classes}
        availableClasses={availableClasses}
        assignedGradeIds={gradeIds}
        open={classesOpen}
        onOpenChange={setClassesOpen}
      />
    </div>
  );
}
