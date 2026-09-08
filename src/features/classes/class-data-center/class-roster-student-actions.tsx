"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import type { Role } from "@/config/roles";
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
  archiveStudentAction,
  deleteStudentAction,
  removeStudentFromClassAction,
  type RosterMutationState,
} from "@/features/students/roster-management-actions";
import {
  archiveStudentConfirmMessage,
  deleteStudentConfirmMessage,
  removeFromClassConfirmMessage,
} from "@/features/students/student-delete-safety";
import type { ClassDataCenterRosterStudent } from "./load-class-data-center-students";

type ConfirmKind = "remove" | "archive" | "delete" | null;

export function ClassRosterStudentActions({
  role,
  classId,
  classTitle,
  student,
}: {
  role: Role;
  classId: string;
  classTitle: string;
  student: ClassDataCenterRosterStudent;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const [removeState, removeAction, removePending] = useActionState(
    async (
      prev: RosterMutationState | undefined,
      formData: FormData,
    ): Promise<RosterMutationState> => {
      const result = await removeStudentFromClassAction(prev, formData);
      if (result.ok) {
        setConfirm(null);
        router.refresh();
      }
      return result;
    },
    undefined,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    async (
      prev: RosterMutationState | undefined,
      formData: FormData,
    ): Promise<RosterMutationState> => {
      const result = await archiveStudentAction(prev, formData);
      if (result.ok) {
        setConfirm(null);
        router.refresh();
      }
      return result;
    },
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (
      prev: RosterMutationState | undefined,
      formData: FormData,
    ): Promise<RosterMutationState> => {
      const result = await deleteStudentAction(prev, formData);
      if (result.ok) {
        setConfirm(null);
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  const pending = removePending || archivePending || deletePending;

  const hiddenFields = (
    <>
      <input type="hidden" name="dashboardRole" value={role} />
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={student.studentId} />
    </>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="relative z-[3] size-9 shrink-0 p-0"
            disabled={pending}
            aria-label={`Actions for ${student.displayName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={student.editHref}>Edit student</Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("remove")}>
            Remove from class
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {student.canHardDelete ? (
            <DropdownMenuItem
              disabled={pending}
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirm("delete")}
            >
              Delete student
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("archive")}>
              Archive student
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm === "remove"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from class?</DialogTitle>
            <DialogDescription>
              {removeFromClassConfirmMessage(student.displayName, classTitle)}
            </DialogDescription>
          </DialogHeader>
          {!removeState?.ok && removeState?.message ? (
            <p className="text-destructive text-sm" role="alert">
              {removeState.message}
            </p>
          ) : null}
          <form action={removeAction}>
            {hiddenFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={removePending}>
                {removePending ? "Removing…" : "Remove from class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive student?</DialogTitle>
            <DialogDescription>
              {archiveStudentConfirmMessage(student.displayName)}
            </DialogDescription>
          </DialogHeader>
          {!archiveState?.ok && archiveState?.message ? (
            <p className="text-destructive text-sm" role="alert">
              {archiveState.message}
            </p>
          ) : null}
          <form action={archiveAction}>
            {hiddenFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete student?</DialogTitle>
            <DialogDescription>
              {deleteStudentConfirmMessage(student.displayName)}
            </DialogDescription>
          </DialogHeader>
          {!deleteState?.ok && deleteState?.message ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteState.message}
            </p>
          ) : null}
          <form action={deleteAction}>
            {hiddenFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {deletePending ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
