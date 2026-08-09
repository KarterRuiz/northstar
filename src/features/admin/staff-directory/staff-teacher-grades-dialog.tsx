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
import { AdminStaffGradeLevelsField } from "@/features/admin/staff-directory/admin-assigned-grade-levels-field";
import type { GradeInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type { StaffGradeAccessRow } from "@/features/admin/staff-directory/staff-directory-queries";
import {
  replaceStaffTeacherGradeAccessAction,
  type StaffTeacherGradeActionState,
} from "@/features/admin/staff-directory/staff-teacher-grade-actions";

type StaffTeacherGradesDialogProps = {
  teacherProfileId: string;
  teacherLabel: string;
  assigned: StaffGradeAccessRow[];
  availableGrades: GradeInviteOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function StaffTeacherGradesDialog({
  teacherProfileId,
  teacherLabel,
  assigned,
  availableGrades,
  open,
  onOpenChange,
  trigger,
}: StaffTeacherGradesDialogProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    StaffTeacherGradeActionState | undefined,
    FormData
  >(replaceStaffTeacherGradeAccessAction, undefined);

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
          <DialogTitle>Manage grade access</DialogTitle>
          <DialogDescription>
            Program/grade scope for {teacherLabel}. Separate from the exact classes they teach.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="teacherProfileId" value={teacherProfileId} />
          <AdminStaffGradeLevelsField
            key={`${teacherProfileId}-${[...initialIds].sort().join(",")}`}
            options={availableGrades}
            disabled={pending}
            initialSelectedIds={initialIds}
            label="Grade levels"
            description="Teachers with only grade access (no classes) can work within these grades."
          />
          {state && !state.ok ? (
            <p className="text-destructive text-xs" role="alert">
              {state.message}
            </p>
          ) : null}
          {state?.ok && state.message ? (
            <p className="text-primary text-xs" role="status">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save grade access"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
