"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdminTeacherInviteAssignedClasses } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  replaceStaffMemberClassAccessAction,
  replaceStaffMemberGradeAccessAction,
  type StaffMemberActionState,
} from "@/features/admin/staff-directory/staff-members-actions";

type GradesDialogProps = {
  staffMemberId: string;
  teacherLabel: string;
  assigned: StaffGradeAccessRow[];
  availableGrades: GradeInviteOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function StaffMemberGradesDialog({
  staffMemberId,
  teacherLabel,
  assigned,
  availableGrades,
  open,
  onOpenChange,
  trigger,
}: GradesDialogProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(replaceStaffMemberGradeAccessAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onOpenChange?.(false);
    }
  }, [state?.ok, router, onOpenChange]);

  const initialIds = assigned.map((a) => a.gradeLevelId);
  const controlled = open !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlled || trigger ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline" size="sm">
              Grades
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign grade levels</DialogTitle>
          <DialogDescription>
            Program/grade scope for {teacherLabel}. Applied on invite accept if they are not active
            yet.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="staffMemberId" value={staffMemberId} />
          <AdminStaffGradeLevelsField
            key={`${staffMemberId}-${[...initialIds].sort().join(",")}`}
            options={availableGrades}
            disabled={pending}
            initialSelectedIds={initialIds}
            label="Grade levels"
          />
          {state && !state.ok ? (
            <p className="text-destructive text-xs" role="alert">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save grades"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ClassesDialogProps = {
  staffMemberId: string;
  teacherLabel: string;
  assigned: StaffClassAssignmentRow[];
  availableClasses: ClassInviteOption[];
  assignedGradeIds: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function StaffMemberClassesDialog({
  staffMemberId,
  teacherLabel,
  assigned,
  availableClasses,
  assignedGradeIds,
  open,
  onOpenChange,
  trigger,
}: ClassesDialogProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    StaffMemberActionState | undefined,
    FormData
  >(replaceStaffMemberClassAccessAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onOpenChange?.(false);
    }
  }, [state?.ok, router, onOpenChange]);

  const initialIds = assigned.map((a) => a.classId);
  const controlled = open !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlled || trigger ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline" size="sm">
              Classes
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign classes</DialogTitle>
          <DialogDescription>
            Classes for {teacherLabel}. Pre-assigned before invite; activated when they accept.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="staffMemberId" value={staffMemberId} />
          <AdminTeacherInviteAssignedClasses
            key={`${staffMemberId}-${[...initialIds].sort().join(",")}`}
            options={availableClasses}
            disabled={pending}
            initialSelectedIds={initialIds}
            allowedGradeLevelIds={assignedGradeIds}
          />
          {state && !state.ok ? (
            <p className="text-destructive text-xs" role="alert">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save classes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
