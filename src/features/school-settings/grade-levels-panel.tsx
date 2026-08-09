"use client";

import { MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WorkspaceToast,
  useWorkspaceToast,
} from "@/components/workspace/workspace-toast";
import {
  archiveGradeLevelAction,
  createGradeLevelAction,
  deleteGradeLevelAction,
  restoreGradeLevelAction,
  updateGradeLevelAction,
  type GradeLevelMutationState,
} from "@/features/classes/grade-level-management-actions";
import {
  inferCodeFromName,
  inferSortOrderFromName,
} from "@/features/classes/grade-level-helpers";
import type { GradeLevelListItem } from "@/features/school-settings/load-academic-structure-data";

function useMutationToast(
  state: GradeLevelMutationState | undefined,
  showToast: (kind: "success" | "error", message: string) => void,
) {
  const lastHandled = useRef<GradeLevelMutationState | undefined>(undefined);

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

function GradeLevelEditDialog({
  grade,
  open,
  onOpenChange,
  showToast,
}: {
  grade: GradeLevelListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const [state, action, pending] = useActionState(updateGradeLevelAction, undefined);
  useMutationToast(state, showToast);

  const [closedForState, setClosedForState] = useState<typeof state>(undefined);
  if (state?.ok && state !== closedForState) {
    setClosedForState(state);
    if (open) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {grade.name}</DialogTitle>
          <DialogDescription>
            Update the name, short code, or display order. Existing classes and records stay linked
            to this grade.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="gradeLevelId" value={grade.id} />
          {!state?.ok && state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`gl-edit-name-${grade.id}`}>Name</Label>
            <Input
              id={`gl-edit-name-${grade.id}`}
              name="name"
              required
              defaultValue={grade.name}
              placeholder="Grade 5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`gl-edit-code-${grade.id}`}>
                Code <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id={`gl-edit-code-${grade.id}`}
                name="code"
                defaultValue={grade.code ?? ""}
                placeholder="G5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`gl-edit-sort-${grade.id}`}>Display order</Label>
              <Input
                id={`gl-edit-sort-${grade.id}`}
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                required
                defaultValue={grade.sort_order}
              />
              <p className="text-muted-foreground text-xs">
                Controls where this grade appears in lists. Multiple grades may share the same
                order.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmKind = "archive" | "restore" | "delete" | null;

function GradeLevelRowActions({
  grade,
  showToast,
}: {
  grade: GradeLevelListItem;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveGradeLevelAction,
    undefined,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreGradeLevelAction,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGradeLevelAction,
    undefined,
  );

  useMutationToast(archiveState, showToast);
  useMutationToast(restoreState, showToast);
  useMutationToast(deleteState, showToast);

  const pending = archivePending || restorePending || deletePending;
  const lastState = deleteState ?? restoreState ?? archiveState;
  const canDelete = grade.classCount === 0;
  const deleteBlockedReason = canDelete
    ? null
    : `${grade.name} cannot be deleted because school records are attached to it. Archive it instead.`;

  const [clearedForState, setClearedForState] = useState<typeof lastState>(undefined);
  if (lastState?.ok && lastState !== clearedForState) {
    setClearedForState(lastState);
    if (confirm !== null) setConfirm(null);
  }

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
            aria-label={`Actions for ${grade.name}`}
          >
            Actions
            <MoreHorizontal className="size-3.5 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled={pending} onSelect={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {grade.is_archived ? (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("restore")}>
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => setConfirm("archive")}>
              Archive
            </DropdownMenuItem>
          )}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirm("delete")}
              >
                Delete permanently
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <GradeLevelEditDialog
        grade={grade}
        open={editOpen}
        onOpenChange={setEditOpen}
        showToast={showToast}
      />

      <Dialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {grade.name}?</DialogTitle>
            <DialogDescription>
              This hides it from new setup while preserving historical school records.
            </DialogDescription>
          </DialogHeader>
          {!archiveState?.ok && archiveState?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {archiveState.error}
            </p>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="gradeLevelId" value={grade.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "restore"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore {grade.name}?</DialogTitle>
            <DialogDescription>
              This grade will be available again when creating new classes and enrollments.
            </DialogDescription>
          </DialogHeader>
          {!restoreState?.ok && restoreState?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {restoreState.error}
            </p>
          ) : null}
          <form action={restoreAction}>
            <input type="hidden" name="gradeLevelId" value={grade.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={restorePending}>
                {restorePending ? "Restoring…" : "Restore"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {grade.name}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Only unused grade levels can be deleted. Prefer archive when
              school records already use this grade.
            </DialogDescription>
          </DialogHeader>
          {!canDelete ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteBlockedReason}
            </p>
          ) : (
            <p className="ns-muted">No classes or linked school records were found for this grade.</p>
          )}
          {!deleteState?.ok && deleteState?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteState.error}
            </p>
          ) : null}
          <form action={deleteAction}>
            <input type="hidden" name="gradeLevelId" value={grade.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deletePending || !canDelete}>
                {deletePending ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateGradeLevelForm({
  showToast,
}: {
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const [state, action, pending] = useActionState(createGradeLevelAction, undefined);
  useMutationToast(state, showToast);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  const [sortTouched, setSortTouched] = useState(false);

  const [resetForState, setResetForState] = useState<typeof state>(undefined);
  if (state?.ok && state !== resetForState) {
    setResetForState(state);
    setName("");
    setCode("");
    setCodeTouched(false);
    setSortOrder("");
    setSortTouched(false);
  }

  function onNameChange(next: string) {
    setName(next);
    if (!codeTouched) {
      setCode(inferCodeFromName(next) ?? "");
    }
    if (!sortTouched) {
      const inferred = inferSortOrderFromName(next);
      setSortOrder(inferred === null ? "" : String(inferred));
    }
  }

  return (
    <form
      action={action}
      className="border-border bg-surface-muted space-y-4 rounded-xl border border-dashed p-4"
    >
      <div className="space-y-1">
        <h3 className="ns-card-title">Add grade level</h3>
        <p className="ns-muted">
          Short codes fill in when possible. Display order controls list position—multiple grades
          may share the same order.
        </p>
      </div>
      {!state?.ok && state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="ac-gl-name">Name</Label>
        <Input
          id="ac-gl-name"
          name="name"
          required
          placeholder="Grade 5"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ac-gl-code">
            Code <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="ac-gl-code"
            name="code"
            placeholder="G5"
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ac-gl-sort">
            Display order <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="ac-gl-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            placeholder="5"
            value={sortOrder}
            onChange={(e) => {
              setSortTouched(true);
              setSortOrder(e.target.value);
            }}
          />
          <p className="text-muted-foreground text-xs">
            Controls where this grade appears in lists. Multiple grades may share the same order.
          </p>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create grade level"}
      </Button>
    </form>
  );
}

function GradeLevelsTable({
  grades,
  showToast,
}: {
  grades: GradeLevelListItem[];
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  if (grades.length === 0) {
    return <p className="ns-muted">No grade levels in this list.</p>;
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.map((grade) => (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.name}</TableCell>
              <TableCell className="font-mono text-xs uppercase tracking-wide">
                {grade.code?.trim() || "—"}
              </TableCell>
              <TableCell className="ns-meta">{grade.sort_order}</TableCell>
              <TableCell>
                {grade.is_archived ? (
                  <Badge variant="muted">Archived</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <GradeLevelRowActions grade={grade} showToast={showToast} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function GradeLevelsPanel({ gradeLevels }: { gradeLevels: GradeLevelListItem[] }) {
  const { toast, showToast } = useWorkspaceToast();
  const active = gradeLevels.filter((g) => !g.is_archived);
  const archived = gradeLevels.filter((g) => g.is_archived);

  return (
    <div id="grade-levels" className="space-y-6">
      <WorkspaceToast toast={toast} />

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="ns-card-title">Grade levels</h3>
          <p className="ns-muted">
            Sorted by display order, then name, for class setup and filters. Archive grades you no
            longer offer so historical classes and records stay intact.
          </p>
        </div>
        {active.length === 0 ? (
          <p className="border-border bg-surface-muted ns-muted rounded-xl border border-dashed px-3 py-4">
            No active grade levels yet.
          </p>
        ) : (
          <GradeLevelsTable grades={active} showToast={showToast} />
        )}
      </div>

      {archived.length > 0 ? (
        <div className="space-y-3">
          <h3 className="ns-eyebrow">Archived</h3>
          <GradeLevelsTable grades={archived} showToast={showToast} />
        </div>
      ) : null}

      <CreateGradeLevelForm showToast={showToast} />
    </div>
  );
}
