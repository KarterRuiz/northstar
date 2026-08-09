"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WorkspaceToast,
  useWorkspaceToast,
} from "@/components/workspace/workspace-toast";
import type { SchoolYearRow } from "@/features/classes/load-class-management-data";

import {
  archiveSchoolYearAction,
  createSchoolYearAction,
  restoreSchoolYearAction,
  setCurrentSchoolYearAction,
  updateSchoolYearAction,
  type SchoolYearMutationState,
} from "./school-year-actions";
import { formatSchoolYearRange } from "./school-year-label";

function useMutationToast(
  state: SchoolYearMutationState | undefined,
  showToast: (kind: "success" | "error", message: string) => void,
) {
  const lastHandled = useRef<SchoolYearMutationState | undefined>(undefined);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      showToast("success", state.message ?? "Saved.");
    } else {
      showToast("error", state.error);
    }
  }, [state, showToast]);
}

function SchoolYearRowActions({
  year,
  showToast,
}: {
  year: SchoolYearRow;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const archived = Boolean(year.archived_at);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [editState, editAction, editPending] = useActionState(updateSchoolYearAction, undefined);
  const [currentState, currentAction, currentPending] = useActionState(
    setCurrentSchoolYearAction,
    undefined,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveSchoolYearAction,
    undefined,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreSchoolYearAction,
    undefined,
  );

  useMutationToast(editState, showToast);
  useMutationToast(currentState, showToast);
  useMutationToast(archiveState, showToast);
  useMutationToast(restoreState, showToast);

  const [closedEditFor, setClosedEditFor] = useState<typeof editState>(undefined);
  if (editState?.ok && editState !== closedEditFor) {
    setClosedEditFor(editState);
    if (editOpen) setEditOpen(false);
  }

  const [closedArchiveFor, setClosedArchiveFor] =
    useState<typeof archiveState>(undefined);
  if (archiveState?.ok && archiveState !== closedArchiveFor) {
    setClosedArchiveFor(archiveState);
    if (archiveOpen) setArchiveOpen(false);
  }

  const busy = editPending || currentPending || archivePending || restorePending;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!archived ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
            {!year.is_current ? (
              <form action={currentAction}>
                <input type="hidden" name="schoolYearId" value={year.id} />
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  {currentPending ? "Updating…" : "Set current"}
                </Button>
              </form>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setArchiveOpen(true)}
            >
              Archive
            </Button>
          </>
        ) : (
          <form action={restoreAction}>
            <input type="hidden" name="schoolYearId" value={year.id} />
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              {restorePending ? "Restoring…" : "Restore"}
            </Button>
          </form>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit school year</DialogTitle>
            <DialogDescription>
              Update the label or calendar dates. Labels must stay unique across the school.
            </DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            <input type="hidden" name="schoolYearId" value={year.id} />
            {!editState?.ok && editState?.error ? (
              <p className="text-destructive text-sm" role="alert">
                {editState.error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`edit-sy-label-${year.id}`}>Label</Label>
              <Input
                id={`edit-sy-label-${year.id}`}
                name="label"
                required
                defaultValue={year.label}
                placeholder="2026–2027"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`edit-sy-start-${year.id}`}>Starts on</Label>
                <Input
                  id={`edit-sy-start-${year.id}`}
                  name="startsOn"
                  type="date"
                  required
                  defaultValue={year.starts_on}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-sy-end-${year.id}`}>Ends on</Label>
                <Input
                  id={`edit-sy-end-${year.id}`}
                  name="endsOn"
                  type="date"
                  required
                  defaultValue={year.ends_on}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editPending}>
                {editPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive school year?</DialogTitle>
            <DialogDescription>
              Archiving hides this year from new class setup. Classes, enrollments, and records stay
              intact for history.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{year.label}</p>
          {year.is_current ? (
            <p className="ns-muted">
              This is the Current school year. Archiving it will clear that designation; another
              active year may become Current automatically.
            </p>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="schoolYearId" value={year.id} />
            {!archiveState?.ok && archiveState?.error ? (
              <p className="text-destructive mb-3 text-sm" role="alert">
                {archiveState.error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArchiveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive year"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function YearListItem({
  year,
  showToast,
}: {
  year: SchoolYearRow;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{year.label}</span>
          {year.is_current ? <Badge variant="success">Current</Badge> : null}
          {year.archived_at ? <Badge variant="muted">Archived</Badge> : null}
        </div>
        <p className="ns-meta">{formatSchoolYearRange(year.starts_on, year.ends_on)}</p>
      </div>
      <SchoolYearRowActions year={year} showToast={showToast} />
    </li>
  );
}

export function SchoolYearsPanel({ schoolYears }: { schoolYears: SchoolYearRow[] }) {
  const { toast, showToast } = useWorkspaceToast();
  const [createState, createAction, createPending] = useActionState(
    createSchoolYearAction,
    undefined,
  );

  useMutationToast(createState, showToast);

  const currentYear = schoolYears.find((y) => y.is_current && !y.archived_at) ?? null;
  const otherActive = schoolYears.filter((y) => !y.archived_at && !y.is_current);
  const archivedYears = schoolYears.filter((y) => Boolean(y.archived_at));

  return (
    <div className="space-y-6">
      <WorkspaceToast toast={toast} />

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="ns-card-title">Current school year</h3>
          <p className="ns-muted">
            The operational year used across classes, enrollments, and records workflows.
          </p>
        </div>
        {currentYear ? (
          <ul className="border-border divide-border divide-y rounded-xl border bg-card shadow-xs">
            <YearListItem year={currentYear} showToast={showToast} />
          </ul>
        ) : (
          <p className="border-border bg-surface-muted ns-muted rounded-xl border border-dashed px-3 py-4">
            No Current school year is set. Create one or mark an existing year as Current.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="ns-card-title">Other school years</h3>
          <p className="ns-muted">Active years available for class setup and historical context.</p>
        </div>
        {otherActive.length === 0 ? (
          <p className="ns-muted">No other active school years.</p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-xl border">
            {otherActive.map((y) => (
              <YearListItem key={y.id} year={y} showToast={showToast} />
            ))}
          </ul>
        )}
      </div>

      {archivedYears.length > 0 ? (
        <div className="space-y-3">
          <h3 className="ns-eyebrow">Archived</h3>
          <ul className="border-border divide-border divide-y rounded-xl border opacity-90">
            {archivedYears.map((y) => (
              <YearListItem key={y.id} year={y} showToast={showToast} />
            ))}
          </ul>
        </div>
      ) : null}

      <form
        action={createAction}
        className="border-border bg-surface-muted space-y-4 rounded-xl border border-dashed p-4"
      >
        <div className="space-y-1">
          <h3 className="ns-card-title">Add school year</h3>
          <p className="ns-muted">
            Labels must be unique. Hyphen and dash characters are treated the same.
          </p>
        </div>
        {!createState?.ok && createState?.error ? (
          <p className="text-destructive text-sm" role="alert">
            {createState.error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="ac-sy-label">Label</Label>
          <Input id="ac-sy-label" name="label" required placeholder="2026–2027" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ac-sy-start">Starts on</Label>
            <Input id="ac-sy-start" name="startsOn" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac-sy-end">Ends on</Label>
            <Input id="ac-sy-end" name="endsOn" type="date" required />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="makeCurrent"
            className="border-input size-4 rounded border"
          />
          Set as Current school year
        </label>
        <Button type="submit" disabled={createPending}>
          {createPending ? "Saving…" : "Create school year"}
        </Button>
      </form>
    </div>
  );
}
