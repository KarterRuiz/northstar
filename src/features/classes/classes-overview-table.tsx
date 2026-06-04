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
import { CLASS_DELETE_CONFIRM_HINT, CLASS_HAS_RECORDS_MESSAGE } from "./constants";
import type { ClassManagementClassRow } from "./load-class-management-data";

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

type ConfirmKind = "archive" | "restore" | "delete" | null;

function ClassRowActions({
  klass,
  onMutation,
}: {
  klass: ClassManagementClassRow;
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

function ClassesTable({
  rows,
  emptyMessage,
  onMutation,
}: {
  rows: ClassManagementClassRow[];
  emptyMessage: string;
  onMutation: (state: ClassManagementMutationState) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground border-muted rounded-md border border-dashed px-4 py-6 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="min-w-[12rem]">Teachers</TableHead>
          <TableHead className="min-w-[10rem]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>{c.schoolYearLabel}</TableCell>
            <TableCell>{c.gradeLevelName}</TableCell>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-muted-foreground">{c.section ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={c.is_active ? "default" : "secondary"}>
                {c.is_active ? "Active" : "Archived"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {c.teachers.length === 0 ? (
                "—"
              ) : (
                <ul className="list-inside list-disc space-y-0.5">
                  {c.teachers.map((t) => (
                    <li key={t.id}>
                      <span className="capitalize">{t.role.replace("_", " ")}</span>:{" "}
                      {t.teacherLabel}
                    </li>
                  ))}
                </ul>
              )}
            </TableCell>
            <TableCell>
              <ClassRowActions klass={c} onMutation={onMutation} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ClassesOverviewTable({ classes }: { classes: ClassManagementClassRow[] }) {
  const [banner, setBanner] = useState<ClassManagementMutationState | undefined>();

  const active = classes.filter((c) => c.is_active);
  const archived = classes.filter((c) => !c.is_active);

  return (
    <div className="space-y-8">
      <MutationBanner state={banner} />

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Active classes</h3>
        <ClassesTable
          rows={active}
          emptyMessage="No active classes. Create a class above or restore an archived one."
          onMutation={setBanner}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Archived classes</h3>
        <p className="text-muted-foreground text-sm">
          Archived classes are hidden from teacher workflows; historical enrollments and records are
          preserved.
        </p>
        <ClassesTable
          rows={archived}
          emptyMessage="No archived classes."
          onMutation={setBanner}
        />
      </section>
    </div>
  );
}

