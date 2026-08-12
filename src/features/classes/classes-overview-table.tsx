"use client";

import { MoreHorizontal } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { classDisplayName } from "./class-management-filters";
import { ClassEditDetailsDialog } from "./class-edit-details-dialog";
import { ClassTeachersEditDialog } from "./class-teachers-edit-dialog";
import {
  CLASS_DELETE_CONFIRM_HINT,
  CLASS_HAS_RECORDS_MESSAGE,
  CLASS_TEACHER_ROLE_HOMEROOM,
  formatClassTeacherRoleForDisplay,
} from "./constants";
import type {
  ClassManagementClassRow,
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "./load-class-management-data";

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
  const base = classDisplayName(c);
  return `${c.schoolYearLabel} · ${c.gradeLevelName} · ${base}`;
}

function homeroomLabel(c: ClassManagementClassRow): string | null {
  const hr = c.teachers.find((t) => t.role === CLASS_TEACHER_ROLE_HOMEROOM);
  return hr?.teacherLabel ?? null;
}

type ConfirmKind = "archive" | "restore" | "delete" | null;

function ClassRowActions({
  klass,
  teachers,
  schoolYears,
  gradeLevels,
  onMutation,
}: {
  klass: ClassManagementClassRow;
  teachers: TeacherOption[];
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  onMutation: (state: ClassManagementMutationState) => void;
}) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editTeachersOpen, setEditTeachersOpen] = useState(false);
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
  const teachersUnavailable = teachers.length === 0;
  const displayName = classDisplayName(klass);

  useEffect(() => {
    if (lastState) onMutation(lastState);
  }, [lastState, onMutation]);

  const hiddenClassId = <input type="hidden" name="classId" value={klass.id} />;

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
            aria-label={`Actions for ${classRowLabel(klass)}`}
          >
            Actions
            <MoreHorizontal className="size-3.5 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => setEditDetailsOpen(true)}
          >
            Edit class details
          </DropdownMenuItem>
          {klass.is_active ? (
            <DropdownMenuItem
              disabled={pending || teachersUnavailable}
              title={
                teachersUnavailable
                  ? "Add eligible staff in Teachers & Staff before assigning class teachers."
                  : undefined
              }
              onSelect={() => setEditTeachersOpen(true)}
            >
              Edit teachers
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {klass.is_active ? (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("archive")}>
              Archive class
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("restore")}>
              Restore class
            </DropdownMenuItem>
          )}
          {klass.deletable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm("delete")}
              >
                Delete class
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ClassEditDetailsDialog
        klass={klass}
        schoolYears={schoolYears}
        gradeLevels={gradeLevels}
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
      />

      {klass.is_active ? (
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
            <DialogTitle>Archive {displayName}?</DialogTitle>
            <DialogDescription>
              This class will be removed from active class views but its historical records will
              remain available.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{classRowLabel(klass)}</p>
          <form action={archiveAction} onSubmit={() => setConfirm(null)}>
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
            <DialogTitle>Restore {displayName}?</DialogTitle>
            <DialogDescription>
              The class will return to the active Classes list. Existing enrollment, teacher
              assignments, and academic history stay intact.
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
  schoolYears,
  gradeLevels,
  emphasizeSchoolYear = false,
}: {
  classes: ClassManagementClassRow[];
  teachers: TeacherOption[];
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
  /** When viewing archive, always surface school year under the class name. */
  emphasizeSchoolYear?: boolean;
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
              {emphasizeSchoolYear ? (
                <TableHead className="whitespace-nowrap">School year</TableHead>
              ) : null}
              <TableHead className="min-w-[10rem]">Homeroom teacher</TableHead>
              <TableHead className="min-w-[9rem]">Other teachers</TableHead>
              <TableHead className="text-right tabular-nums">Students</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="min-w-[7rem]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c) => {
              const hr = homeroomLabel(c);
              const additional = c.teachers.filter((t) => t.role !== CLASS_TEACHER_ROLE_HOMEROOM);
              const section = c.section?.trim();
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name.trim() || "—"}</div>
                    <div className="text-muted-foreground text-xs">
                      {emphasizeSchoolYear
                        ? section
                          ? `Section ${section}`
                          : null
                        : section
                          ? `Section ${section}`
                          : c.schoolYearLabel}
                    </div>
                  </TableCell>
                  <TableCell>{c.gradeLevelName}</TableCell>
                  {emphasizeSchoolYear ? (
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.schoolYearLabel}
                    </TableCell>
                  ) : null}
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
                    <ClassRowActions
                      klass={c}
                      teachers={teachers}
                      schoolYears={schoolYears}
                      gradeLevels={gradeLevels}
                      onMutation={setBanner}
                    />
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
