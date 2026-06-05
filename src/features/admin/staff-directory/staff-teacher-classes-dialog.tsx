"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminStaffDirectoryClassPicker } from "@/features/admin/staff-directory/admin-assigned-classes-field";
import type { ClassInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type { StaffClassAssignmentRow } from "@/features/admin/staff-directory/staff-directory-queries";
import {
  assignStaffTeacherToClassAction,
  removeStaffTeacherFromClassAction,
  type StaffTeacherClassActionState,
} from "@/features/admin/staff-directory/staff-teacher-class-actions";

function StaffTeacherAddClassForm({
  teacherProfileId,
  addOptions,
}: {
  teacherProfileId: string;
  addOptions: ClassInviteOption[];
}) {
  const router = useRouter();
  const [addClassId, setAddClassId] = useState("");
  const [assignState, assignAction, assignPending] = useActionState<
    StaffTeacherClassActionState | undefined,
    FormData
  >(assignStaffTeacherToClassAction, undefined);

  useEffect(() => {
    if (assignState?.ok) {
      router.refresh();
    }
  }, [assignState?.ok, router]);

  return (
    <>
      <form action={assignAction} className="flex flex-col gap-2 border-t pt-4">
        <input type="hidden" name="teacherProfileId" value={teacherProfileId} />
        <input type="hidden" name="classId" value={addClassId} />
        <Label htmlFor={`add-class-${teacherProfileId}`}>Add to class</Label>
        <AdminStaffDirectoryClassPicker
          id={`add-class-${teacherProfileId}`}
          options={addOptions}
          value={addClassId}
          onValueChange={setAddClassId}
          disabled={assignPending}
          placeholder="Search classes to add…"
        />
        <Button type="submit" size="sm" disabled={assignPending || !addClassId} className="w-fit">
          {assignPending ? "Adding…" : "Add assignment"}
        </Button>
      </form>
      {assignState && !assignState.ok ? (
        <p className="text-destructive text-xs" role="alert">
          {assignState.message}
        </p>
      ) : null}
    </>
  );
}

type StaffTeacherClassesPanelProps = {
  teacherProfileId: string;
  assigned: StaffClassAssignmentRow[];
  availableClasses: ClassInviteOption[];
};

export function StaffTeacherClassesPanel({
  teacherProfileId,
  assigned,
  availableClasses,
}: StaffTeacherClassesPanelProps) {
  const router = useRouter();
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.classId)), [assigned]);
  const addOptions = useMemo(
    () => availableClasses.filter((c) => !assignedIds.has(c.id)),
    [availableClasses, assignedIds],
  );

  const [removeState, removeAction, removePending] = useActionState<
    StaffTeacherClassActionState | undefined,
    FormData
  >(removeStaffTeacherFromClassAction, undefined);

  const assignedClassKey = useMemo(
    () => assigned.map((a) => a.classId).sort().join(","),
    [assigned],
  );

  useEffect(() => {
    if (removeState?.ok) {
      router.refresh();
    }
  }, [removeState?.ok, router]);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-foreground mb-2 text-sm font-medium">Assigned classes</h4>
        {assigned.length === 0 ? (
          <p className="text-muted-foreground text-sm">Not assigned to any class yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year / grade / class</TableHead>
                <TableHead className="w-[7rem]">Role</TableHead>
                <TableHead className="w-[6rem]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.map((a) => (
                <TableRow key={a.assignmentId}>
                  <TableCell className="text-sm">
                    <div className="font-medium">
                      {a.schoolYearLabel} · {a.gradeName} · {a.className}
                    </div>
                    {a.section ? (
                      <div className="text-muted-foreground text-xs">§ {a.section}</div>
                    ) : null}
                    {!a.classIsActive ? (
                      <div className="text-muted-foreground mt-0.5 text-xs">Archived class</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs capitalize">
                    {a.assignmentRole.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={removeAction}>
                      <input type="hidden" name="assignmentId" value={a.assignmentId} />
                      <Button type="submit" variant="ghost" size="sm" disabled={removePending}>
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {addOptions.length > 0 ? (
        <StaffTeacherAddClassForm
          key={assignedClassKey}
          teacherProfileId={teacherProfileId}
          addOptions={addOptions}
        />
      ) : assigned.length > 0 ? (
        <p className="text-muted-foreground text-xs">All active classes already include this teacher.</p>
      ) : null}
      {removeState && !removeState.ok ? (
        <p className="text-destructive text-xs" role="alert">
          {removeState.message}
        </p>
      ) : null}
    </div>
  );
}

type StaffTeacherClassesDialogProps = StaffTeacherClassesPanelProps & {
  teacherLabel: string;
};

export function StaffTeacherClassesDialog({
  teacherProfileId,
  teacherLabel,
  assigned,
  availableClasses,
}: StaffTeacherClassesDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Classes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Class assignments</DialogTitle>
          <DialogDescription>{teacherLabel}</DialogDescription>
        </DialogHeader>
        <StaffTeacherClassesPanel
          teacherProfileId={teacherProfileId}
          assigned={assigned}
          availableClasses={availableClasses}
        />
      </DialogContent>
    </Dialog>
  );
}
