"use client";

import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  archiveClassAction,
  deleteClassAction,
  restoreClassAction,
  type ClassManagementMutationState,
} from "./class-management-actions";
import { ClassTeachersEditDialog } from "./class-teachers-edit-dialog";
import {
  CLASS_DELETE_CONFIRM_HINT,
  CLASS_HAS_RECORDS_MESSAGE,
  CLASS_TEACHER_ROLE_HOMEROOM,
  formatClassTeacherRoleForDisplay,
} from "./constants";
import type { ClassManagementClassRow, TeacherOption } from "./load-class-management-data";

function MutationBanner({ state }: { state: ClassManagementMutationState | undefined }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  return (
    <p className="text-primary text-sm" role="status">
      {state.message ?? "Saved."}
    </p>
  );
}

function classRowLabel(c: ClassManagementClassRow): string {
  const sec = c.section?.trim();
  const base = c.name.trim() || "Class";
  return `${c.schoolYearLabel} · ${c.gradeLevelName} · ${base}${sec ? ` ${sec}` : ""}`;
}

function homeroomLabel(c: ClassManagementClassRow): string | null {
  const hr = c.teachers.find((t) => t.role === CLASS_TEACHER_ROLE_HOMEROOM);
  return hr?.teacherLabel ?? null;
}

type ConfirmKind = "archive" | "restore" | "delete" | null;

function ClassRowActions({
  klass,
  teachers,
  onMutation,
}: {
  klass: ClassManagementClassRow;
  teachers: TeacherOption[];
  onMutation: (state: ClassManagementMutationState) => void;
}) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveClassAction,
    undefined,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreClassAction,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteClassAction,
    undefined,
  );

  const pending = archivePending || restorePending || deletePending;
  const lastState = deleteState ?? restoreState ?? archiveState;

  useEffect(() => {
    if (lastState) onMutation(lastState);
  }, [lastState, onMutation]);

  const hiddenClassId = <input type="hidden" name="classId" value={klass.id} />;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {klass.is_active ? (
          <ClassTeachersEditDialog
            klass={klass}
            teachers={teachers}
            disabled={teachers.length === 0 || pending}
            disabledReason={
              teachers.length === 0
                ? "Add at least one user with the teacher role before assigning class teachers."
                : "Wait for the current action to finish."
            }
          />
        ) : null}
        {klass.is_active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirm("archive")}
          >
            Archive
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirm("restore")}
          >
            Restore
          </Button>
        )}
        {klass.deletable ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => setConfirm("delete")}
            aria-label="Permanently delete this class"
          >
            Delete
          </Button>
        ) : (
          <span className="inline-flex" title={CLASS_HAS_RECORDS_MESSAGE}>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled
              aria-label={`Delete unavailable. ${CLASS_HAS_RECORDS_MESSAGE}`}
            >
              Delete
            </Button>
          </span>
        )}
      </div>

      <Dialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive class?</DialogTitle>
            <DialogDescription>
              This hides the class from active workflows while preserving historical academic
              records.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{classRowLabel(klass)}</p>
          <form
            action={archiveAction}
            onSubmit={() => setConfirm(null)}
          >
            {hiddenClassId}
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
            <DialogTitle>Restore class?</DialogTitle>
            <DialogDescription>
              The class will appear again in active teacher dashboards and roster workflows.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{classRowLabel(klass)}</p>
          <form action={restoreAction} onSubmit={() => setConfirm(null)}>
            {hiddenClassId}
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

      <Dialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete class?</DialogTitle>
            <DialogDescription>{CLASS_DELETE_CONFIRM_HINT}</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{classRowLabel(klass)}</p>
          {!klass.deletable ? (
            <p className="text-destructive text-sm" role="alert">
              {CLASS_HAS_RECORDS_MESSAGE}
            </p>
          ) : null}
          <form action={deleteAction} onSubmit={() => setConfirm(null)}>
            {hiddenClassId}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deletePending || !klass.deletable}
              >
                {deletePending ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ClassesOverviewTable({
  classes,
  teachers,
}: {
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
}) {
  const [banner, setBanner] = useState<ClassManagementMutationState | undefined>();

  return (
    <div className="space-y-4">
      <MutationBanner state={banner} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[12rem]">Class</TableHead>
              <TableHead className="whitespace-nowrap">Grade</TableHead>
              <TableHead className="min-w-[10rem]">Homeroom teacher</TableHead>
              <TableHead className="min-w-[9rem]">Other teachers</TableHead>
              <TableHead className="text-right tabular-nums">Students</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="min-w-[10rem]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => {
              const hr = homeroomLabel(c);
              const additional = c.teachers.filter((t) => t.role !== CLASS_TEACHER_ROLE_HOMEROOM);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name.trim() || "—"}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.section?.trim() ? `Section ${c.section}` : c.schoolYearLabel}
                    </div>
                  </TableCell>
                  <TableCell>{c.gradeLevelName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {hr ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[16rem] text-xs">
                    {additional.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="list-inside list-disc space-y-0.5">
                        {additional.map((t) => (
                          <li key={t.id}>
                            <span>{formatClassTeacherRoleForDisplay(t.role)}</span>: {t.teacherLabel}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.studentEnrollmentCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ClassRowActions klass={c} teachers={teachers} onMutation={setBanner} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
