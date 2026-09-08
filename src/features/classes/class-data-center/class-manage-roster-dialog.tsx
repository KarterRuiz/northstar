"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import {
  archiveStudentAction,
  enrollExistingStudentInClassAction,
  removeStudentFromClassAction,
  type RosterMutationState,
} from "@/features/students/roster-management-actions";
import {
  searchStudentsForClassEnrollmentAction,
  type EnrollmentCandidate,
} from "@/features/students/search-students-for-class-enrollment";
import {
  archiveStudentConfirmMessage,
  removeFromClassConfirmMessage,
} from "@/features/students/student-delete-safety";
import { matchesClassRosterSearch } from "@/features/teacher/class-workspace/class-roster";
import {
  classDataCenterAddStudentHref,
  classDataCenterRosterImportHref,
} from "./constants";
import { ClassRosterStudentActions } from "./class-roster-student-actions";
import type { ClassDataCenterRosterStudent } from "./load-class-data-center-students";

type BulkConfirm = "remove" | "archive" | null;

function useActionStateRefresh(
  action: (
    prev: RosterMutationState | undefined,
    formData: FormData,
  ) => Promise<RosterMutationState>,
  onSuccess: () => void,
  router: ReturnType<typeof useRouter>,
) {
  return useActionState(
    async (
      prev: RosterMutationState | undefined,
      formData: FormData,
    ): Promise<RosterMutationState> => {
      const result = await action(prev, formData);
      if (result.ok) {
        onSuccess();
        router.refresh();
      }
      return result;
    },
    undefined,
  );
}

export function ClassManageRosterDialog({
  open,
  onOpenChange,
  role,
  classId,
  classTitle,
  schoolYearLabel,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  classId: string;
  classTitle: string;
  schoolYearLabel: string | null;
  students: ClassDataCenterRosterStudent[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirm>(null);
  const [enrollQuery, setEnrollQuery] = useState("");
  const [candidates, setCandidates] = useState<EnrollmentCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [dialogEpoch, setDialogEpoch] = useState(0);

  const [removeState, removeAction, removePending] = useActionStateRefresh(
    removeStudentFromClassAction,
    () => {
      setBulkConfirm(null);
      setSelected(new Set());
    },
    router,
  );
  const [archiveState, archiveAction, archivePending] = useActionStateRefresh(
    archiveStudentAction,
    () => {
      setBulkConfirm(null);
      setSelected(new Set());
    },
    router,
  );
  const [enrollState, enrollAction, enrollPending] = useActionStateRefresh(
    enrollExistingStudentInClassAction,
    () => {
      setEnrollQuery("");
      setCandidates([]);
      setEnrollingId(null);
    },
    router,
  );

  const pending = removePending || archivePending || enrollPending;

  const visible = useMemo(() => {
    return students.filter((row) => matchesClassRosterSearch(row.searchText, query));
  }, [students, query]);

  function resetLocalState() {
    setQuery("");
    setSelected(new Set());
    setBulkConfirm(null);
    setEnrollQuery("");
    setCandidates([]);
    setSearchError(null);
    setEnrollingId(null);
    setDialogEpoch((n) => n + 1);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetLocalState();
    onOpenChange(next);
  }

  function runEnrollmentSearch(raw: string) {
    setEnrollQuery(raw);
    const q = raw.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearchError(null);
      return;
    }
    startSearch(async () => {
      const result = await searchStudentsForClassEnrollmentAction({
        classId,
        query: q,
      });
      if (!result.ok) {
        setSearchError(result.message);
        setCandidates([]);
        return;
      }
      setSearchError(null);
      setCandidates(result.students);
    });
  }

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAllVisible() {
    const ids = visible.map((s) => s.studentId);
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  const selectedStudents = students.filter((s) => selected.has(s.studentId));
  const selectedCount = selectedStudents.length;
  const selectedLabel =
    selectedCount === 1
      ? selectedStudents[0]!.displayName
      : `${selectedCount} students`;

  const contextLine = [
    classTitle,
    schoolYearLabel?.trim() || null,
    students.length === 1 ? "1 enrolled" : `${students.length} enrolled`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Dialog open={open && bulkConfirm == null} onOpenChange={handleOpenChange}>
        <DialogContent
          key={dialogEpoch}
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <div className="border-border space-y-1 border-b px-5 py-4">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>Manage roster</DialogTitle>
              <DialogDescription>
                {contextLine}. Remove keeps the student record; archive withdraws all active
                enrollments. Delete is only available when there is no dependent history.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0 || pending}
              onClick={() => setBulkConfirm("remove")}
            >
              Remove selected
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCount === 0 || pending}
              onClick={() => setBulkConfirm("archive")}
            >
              Archive selected
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href={classDataCenterAddStudentHref(role, classId)}>Add student</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={classDataCenterRosterImportHref(role, classId)}>Import roster</Link>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-heading text-xs font-semibold tracking-wide uppercase">
                  Current roster ({students.length})
                </label>
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter roster…"
                  autoComplete="off"
                  className="h-9 max-w-xs"
                />
              </div>

              {students.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No students enrolled yet. Enroll an existing student below, or use Add student /
                  Import roster.
                </p>
              ) : visible.length === 0 ? (
                <p className="text-muted-foreground text-sm">No matching students.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="w-10 px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label="Select all visible students"
                            checked={
                              visible.length > 0 &&
                              visible.every((s) => selected.has(s.studentId))
                            }
                            onChange={toggleAllVisible}
                          />
                        </th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Number</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="w-12 px-3 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.studentId} className="border-t">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.displayName}`}
                              checked={selected.has(row.studentId)}
                              onChange={() => toggle(row.studentId)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{row.displayName}</td>
                          <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                            {row.studentNumber ?? "—"}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-xs">Active</td>
                          <td className="px-2 py-1.5 text-right">
                            <ClassRosterStudentActions
                              role={role}
                              classId={classId}
                              classTitle={classTitle}
                              student={row}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-heading text-xs font-semibold tracking-wide uppercase">
                Enroll existing student
              </label>
              <Input
                type="search"
                value={enrollQuery}
                onChange={(e) => runEnrollmentSearch(e.target.value)}
                placeholder="Search by name or student number…"
                autoComplete="off"
                className="h-10"
              />
              {searchError ? (
                <p className="text-destructive text-sm" role="alert">
                  {searchError}
                </p>
              ) : null}
              {!enrollState?.ok && enrollState?.message ? (
                <p className="text-destructive text-sm" role="alert">
                  {enrollState.message}
                </p>
              ) : null}
              {enrollState?.ok && enrollState.message ? (
                <p className="text-muted-foreground text-sm">{enrollState.message}</p>
              ) : null}
              {searchPending && enrollQuery.trim().length >= 2 ? (
                <p className="text-muted-foreground text-sm">Searching…</p>
              ) : null}
              {candidates.length > 0 ? (
                <ul className="divide-border divide-y rounded-lg border">
                  {candidates.map((c) => (
                    <li
                      key={c.studentId}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.displayName}</p>
                        {c.studentNumber ? (
                          <p className="text-muted-foreground font-mono text-xs">
                            {c.studentNumber}
                          </p>
                        ) : null}
                      </div>
                      <form action={enrollAction}>
                        <input type="hidden" name="dashboardRole" value={role} />
                        <input type="hidden" name="classId" value={classId} />
                        <input type="hidden" name="studentId" value={c.studentId} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={enrollPending}
                          onClick={() => setEnrollingId(c.studentId)}
                        >
                          {enrollPending && enrollingId === c.studentId
                            ? "Enrolling…"
                            : "Enroll"}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : enrollQuery.trim().length >= 2 && !searchPending ? (
                <p className="text-muted-foreground text-sm">No matching students to enroll.</p>
              ) : null}
            </div>
          </div>

          <div className="border-border flex justify-end border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkConfirm === "remove"}
        onOpenChange={(o) => !o && setBulkConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from class?</DialogTitle>
            <DialogDescription>
              {removeFromClassConfirmMessage(selectedLabel, classTitle)}
            </DialogDescription>
          </DialogHeader>
          {!removeState?.ok && removeState?.message ? (
            <p className="text-destructive text-sm" role="alert">
              {removeState.message}
            </p>
          ) : null}
          <form action={removeAction}>
            <input type="hidden" name="dashboardRole" value={role} />
            <input type="hidden" name="classId" value={classId} />
            {selectedStudents.map((s) => (
              <input key={s.studentId} type="hidden" name="studentIds" value={s.studentId} />
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={removePending}>
                {removePending ? "Removing…" : "Remove selected"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkConfirm === "archive"}
        onOpenChange={(o) => !o && setBulkConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive selected?</DialogTitle>
            <DialogDescription>
              {archiveStudentConfirmMessage(selectedLabel)}
            </DialogDescription>
          </DialogHeader>
          {!archiveState?.ok && archiveState?.message ? (
            <p className="text-destructive text-sm" role="alert">
              {archiveState.message}
            </p>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="dashboardRole" value={role} />
            <input type="hidden" name="classId" value={classId} />
            {selectedStudents.map((s) => (
              <input key={s.studentId} type="hidden" name="studentIds" value={s.studentId} />
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkConfirm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive selected"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
