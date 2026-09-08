"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  archiveClassAction,
  restoreClassAction,
  type ClassManagementMutationState,
} from "@/features/classes/class-management-actions";
import { ClassEditDetailsDialog } from "@/features/classes/class-edit-details-dialog";
import { ClassTeachersEditDialog } from "@/features/classes/class-teachers-edit-dialog";
import type {
  ClassManagementClassRow,
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "@/features/classes/load-class-management-data";
import { CLASS_TEACHER_ROLE_HOMEROOM } from "@/features/classes/constants";

import {
  classDataCenterManageRosterHref,
  classDataCenterPath,
} from "./constants";
import type { ClassDataCenterContext } from "./load-class-data-center-context";

function contextToManagementRow(context: ClassDataCenterContext): ClassManagementClassRow {
  const teachers = [
    ...(context.homeroom
      ? [
          {
            id: context.homeroom.staffMemberId,
            staffMemberId: context.homeroom.staffMemberId,
            teacherProfileId: context.homeroom.profileId,
            role: CLASS_TEACHER_ROLE_HOMEROOM,
            teacherRole: context.homeroom.roleInClass,
            teacherLabel: context.homeroom.displayName,
          },
        ]
      : []),
    ...context.additionalTeachers.map((t) => ({
      id: t.staffMemberId,
      staffMemberId: t.staffMemberId,
      teacherProfileId: t.profileId,
      role: t.roleInClassDb,
      teacherRole: t.roleInClass,
      teacherLabel: t.displayName,
    })),
  ];

  return {
    id: context.id,
    school_year_id: context.schoolYearId ?? "",
    grade_level_id: context.gradeLevelId,
    name: context.name,
    section: context.section,
    is_active: context.isActive,
    created_at: "",
    updated_at: "",
    schoolYearLabel: context.schoolYearLabel,
    gradeLevelName: context.gradeName,
    teachers,
    studentEnrollmentCount: context.studentCount,
    deletable: false,
  };
}

export function ClassDataCenterActions({
  context,
  teachers = [],
  schoolYears = [],
  gradeLevels = [],
}: {
  context: ClassDataCenterContext;
  teachers?: TeacherOption[];
  schoolYears?: SchoolYearRow[];
  gradeLevels?: GradeLevelRow[];
}) {
  const router = useRouter();
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editTeachersOpen, setEditTeachersOpen] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "restore" | null>(null);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveClassAction,
    undefined,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreClassAction,
    undefined,
  );

  const klass = contextToManagementRow(context);
  const pending = archivePending || restorePending;
  const lastState = restoreState ?? archiveState;
  const teachersUnavailable = teachers.length === 0;

  useEffect(() => {
    if (!lastState?.ok) return;
    router.refresh();
  }, [lastState, router]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pending}
            aria-label={`Actions for ${context.title}`}
          >
            Actions
            <MoreHorizontal className="size-3.5 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={pending || !context.isActive}
            onSelect={() => setEditDetailsOpen(true)}
          >
            Edit class
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={classDataCenterManageRosterHref(context.role, context.id)}>
              Manage roster
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending || !context.isActive || teachersUnavailable}
            title={
              teachersUnavailable
                ? "Add eligible staff in Teachers & Staff before assigning class teachers."
                : !context.isActive
                  ? "Restore this class before changing teachers."
                  : undefined
            }
            onSelect={() => setEditTeachersOpen(true)}
          >
            Manage teachers
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {context.isActive ? (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("archive")}>
              Archive class
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("restore")}>
              Restore class
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={classDataCenterPath(context.role, context.id, "students")}>
              Open students
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {schoolYears.length > 0 && gradeLevels.length > 0 ? (
        <ClassEditDetailsDialog
          klass={klass}
          schoolYears={schoolYears}
          gradeLevels={gradeLevels}
          open={editDetailsOpen}
          onOpenChange={setEditDetailsOpen}
        />
      ) : null}

      {context.isActive && teachers.length > 0 ? (
        <ClassTeachersEditDialog
          klass={klass}
          teachers={teachers}
          open={editTeachersOpen}
          onOpenChange={setEditTeachersOpen}
        />
      ) : null}

      <Dialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {context.title}?</DialogTitle>
            <DialogDescription>
              This class will be removed from active class views but its historical records will
              remain available.
            </DialogDescription>
          </DialogHeader>
          <form action={archiveAction} onSubmit={() => setConfirm(null)}>
            <input type="hidden" name="classId" value={context.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "restore"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore {context.title}?</DialogTitle>
            <DialogDescription>
              The class will return to the active Classes list. Existing enrollment, teacher
              assignments, and academic history stay intact.
            </DialogDescription>
          </DialogHeader>
          <form action={restoreAction} onSubmit={() => setConfirm(null)}>
            <input type="hidden" name="classId" value={context.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={restorePending}>
                {restorePending ? "Restoring…" : "Restore class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MutationBanner state={lastState} />
    </>
  );
}

function MutationBanner({ state }: { state: ClassManagementMutationState | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {state.error}
    </p>
  );
}
