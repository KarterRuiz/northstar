"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createBulkAddRowKey } from "@/features/students/roster-order";

import { createBulkStudentsAction } from "./bulk-add-actions";
import { BulkAddGrid } from "./bulk-add-grid";
import {
  BULK_ADD_INITIAL_ROWS,
  BULK_ADD_MAX_ROWS,
  BULK_ADD_ROW_BATCH,
} from "./constants";
import {
  assessBulkAddPasteOverwrite,
  parseBulkAddPaste,
  planBulkAddPasteApply,
} from "./parse-bulk-paste";

import type {
  BulkAddClassOption,
  BulkAddCreateResult,
  BulkAddRowDraft,
  BulkAddValidatedRow,
} from "./types";
import {
  createEmptyBulkAddRow,
  validateBulkAddRows,
} from "./validate-bulk-rows";

type Step = "edit" | "review" | "result";

type BulkAddWizardProps = {
  dashboardRole: Role;
  classOptions: BulkAddClassOption[];
  /** Match keys of Student Numbers already in Northstar. */
  existingStudentNumbers?: string[];
  /** When launched from a class, preselect that class on new rows. */
  defaultClassId?: string | null;
};

function statusLabel(s: string): string {
  return s.replaceAll("_", " ");
}

function makeInitialRows(classId: string): BulkAddRowDraft[] {
  return Array.from({ length: BULK_ADD_INITIAL_ROWS }, () =>
    createEmptyBulkAddRow(createBulkAddRowKey(), { classId }),
  );
}

export function BulkAddWizard({
  dashboardRole,
  classOptions,
  existingStudentNumbers = [],
  defaultClassId = null,
}: BulkAddWizardProps) {
  const defaultClass =
    defaultClassId && classOptions.some((c) => c.id === defaultClassId)
      ? defaultClassId
      : "";

  const makeKey = () => createBulkAddRowKey();

  const existingNumberSet = useMemo(
    () => new Set(existingStudentNumbers),
    [existingStudentNumbers],
  );

  const [step, setStep] = useState<Step>("edit");
  const [rows, setRows] = useState<BulkAddRowDraft[]>(() =>
    makeInitialRows(defaultClass),
  );
  const [showIssues, setShowIssues] = useState(false);
  const [readyRows, setReadyRows] = useState<BulkAddValidatedRow[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [pasteConfirm, setPasteConfirm] = useState<{
    text: string;
    interpretation: string;
    overwriteCount: number;
    leftover: number;
  } | null>(null);
  const [createResult, setCreateResult] = useState<
    Extract<BulkAddCreateResult, { ok: true }> | null
  >(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validation = useMemo(
    () =>
      validateBulkAddRows(rows, {
        classOptions,
        existingStudentNumbers: existingNumberSet,
      }),
    [rows, classOptions, existingNumberSet],
  );

  const issuesByKey =
    showIssues || step === "review" ? validation.issuesByKey : {};

  const studentsHref = `/dashboard/${dashboardRole}/students`;
  const importHref = `/dashboard/${dashboardRole}/students/import`;

  const updateRow = (key: string, patch: Partial<BulkAddRowDraft>) => {
    // Never rewrite keys; never reorder while typing.
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        return {
          ...row,
          ...patch,
          key: row.key,
        };
      }),
    );
    setShowIssues(false);
    setPasteNote(null);
  };

  const addRows = (count: number) => {
    setRows((prev) => {
      const room = BULK_ADD_MAX_ROWS - prev.length;
      const n = Math.min(count, room);
      if (n <= 0) return prev;
      const inheritClass =
        prev.find((r) => r.classId.trim())?.classId.trim() || defaultClass;
      return [
        ...prev,
        ...Array.from({ length: n }, () =>
          createEmptyBulkAddRow(makeKey(), { classId: inheritClass }),
        ),
      ];
    });
  };

  const removeRow = (key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.key !== key);
    });
    setShowIssues(false);
  };

  const applyPaste = (text: string, forceOverwrite: boolean) => {
    const parsed = parseBulkAddPaste(text);
    if (!parsed) {
      setPasteNote("Could not read pasted spreadsheet data.");
      return;
    }

    if (!forceOverwrite) {
      const assessment = assessBulkAddPasteOverwrite(
        rows,
        parsed.rows.length,
        BULK_ADD_MAX_ROWS,
      );
      if (
        !assessment.canFitWithoutOverwrite &&
        assessment.wouldOverwriteFromTop > 0
      ) {
        setPasteConfirm({
          text,
          interpretation: parsed.interpretation,
          overwriteCount: assessment.wouldOverwriteFromTop,
          leftover: Math.max(0, parsed.rows.length - assessment.blankCapacity),
        });
        return;
      }
    }

    const plan = planBulkAddPasteApply({
      currentRows: rows,
      paste: parsed,
      classOptions,
      makeKey,
      maxRows: BULK_ADD_MAX_ROWS,
      forceOverwrite,
      defaultClassId: defaultClass,
    });

    setRows(plan.nextRows);
    setShowIssues(false);
    setPasteNote(
      `${parsed.interpretation} Filled ${Math.min(parsed.rows.length, plan.nextRows.length)} row(s) for review — nothing saved yet.`,
    );
    setPasteConfirm(null);
  };

  const goReview = () => {
    const next = validateBulkAddRows(rows, {
      classOptions,
      existingStudentNumbers: existingNumberSet,
    });
    setShowIssues(true);
    if (next.readyCount === 0) {
      setCreateError(
        next.needsCorrectionCount > 0
          ? "Fix highlighted rows before reviewing."
          : "Enter at least one student to continue.",
      );
      return;
    }
    if (next.needsCorrectionCount > 0) {
      setCreateError(
        `Ready to create ${next.readyCount}. Needs correction: ${next.needsCorrectionCount}. Fix highlighted rows first — invalid rows are not created.`,
      );
      return;
    }
    setCreateError(null);
    setReadyRows(next.ready);
    setStep("review");
  };

  const createStudents = () => {
    setCreateError(null);
    startTransition(async () => {
      const result = await createBulkStudentsAction({
        dashboardRole,
        rows: readyRows.map((r) => ({
          key: r.key,
          firstName: r.firstName,
          lastName: r.lastName,
          preferredName: r.preferredName,
          studentNumber: r.studentNumber,
          rosterNumber: r.rosterNumber,
          classId: r.classId,
          enrollmentStatus: r.enrollmentStatus,
        })),
      });

      if (!result.ok) {
        setCreateError(result.message);
        return;
      }

      setCreateResult(result);
      setStep("result");
    });
  };

  const resetForMore = () => {
    setRows(makeInitialRows(defaultClass));
    setReadyRows([]);
    setCreateResult(null);
    setCreateError(null);
    setShowIssues(false);
    setPasteNote(null);
    setStep("edit");
  };

  if (step === "result" && createResult) {
    return (
      <div className="space-y-4">
        <div
          className="bg-primary/5 text-primary rounded-xl border border-primary/15 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium">{createResult.message}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Created {createResult.created.length}
            {createResult.failed.length > 0
              ? ` · Failed ${createResult.failed.length}`
              : ""}
          </p>
        </div>

        {createResult.created.length > 0 ? (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roster #</TableHead>
                  <TableHead>Student #</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {createResult.created.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {row.rosterNumber ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.studentNumber}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/${dashboardRole}/students/${row.studentId}/overview`}
                        className="text-primary font-medium hover:underline"
                      >
                        {row.firstName} {row.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{row.classLabel}</TableCell>
                    <TableCell className="capitalize text-xs">
                      {statusLabel(row.enrollmentStatus)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {createResult.failed.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Could not create</h2>
            <ul className="text-destructive space-y-1 text-sm" role="alert">
              {createResult.failed.map((row) => (
                <li key={row.key}>
                  {row.firstName} {row.lastName}: {row.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button asChild>
            <Link href={studentsHref}>View Students</Link>
          </Button>
          <Button type="button" variant="outline" onClick={resetForMore}>
            Add more
          </Button>
          <Button variant="outline" asChild>
            <Link href={importHref}>Import roster</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="bg-primary/5 text-primary rounded-md border border-primary/15 px-2.5 py-1 font-medium">
            Ready to create {readyRows.length}
          </span>
          <span className="text-muted-foreground">Needs correction 0</span>
        </div>

        {createError ? (
          <p className="text-destructive text-sm" role="alert">
            {createError}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roster #</TableHead>
                <TableHead>Student #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readyRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {row.rosterNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.studentNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.firstName} {row.lastName}
                    {row.preferredName ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        ({row.preferredName})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">{row.classLabel}</TableCell>
                  <TableCell className="capitalize text-xs">
                    {statusLabel(row.enrollmentStatus)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-muted-foreground text-xs">
          Student Number is school-wide and required. Roster # is class order and
          stays as entered. Grade follows each selected class. All listed students
          will be created with enrollment records in one action.
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setStep("edit")}
          >
            Back to edit
          </Button>
          <Button type="button" disabled={pending} onClick={createStudents}>
            {pending
              ? "Creating…"
              : `Create ${readyRows.length} student${readyRows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pasteNote ? (
        <p
          className="bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2 text-xs"
          role="status"
        >
          {pasteNote}
        </p>
      ) : null}

      {createError ? (
        <p className="text-destructive text-sm" role="alert">
          {createError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md border px-2.5 py-1 font-medium">
          Ready to create {validation.readyCount}
        </span>
        <span
          className={
            validation.needsCorrectionCount > 0
              ? "text-destructive font-medium"
              : "text-muted-foreground"
          }
        >
          Needs correction {validation.needsCorrectionCount}
        </span>
      </div>

      <BulkAddGrid
        rows={rows}
        classOptions={classOptions}
        issuesByKey={issuesByKey}
        disabled={pending}
        onChangeRow={updateRow}
        onAddRow={() => addRows(1)}
        onAddRowBatch={() => addRows(BULK_ADD_ROW_BATCH)}
        onRemoveRow={removeRow}
        onPaste={(text) => applyPaste(text, false)}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" asChild>
          <Link href={studentsHref}>Cancel</Link>
        </Button>
        <Button type="button" onClick={goReview}>
          Review students
        </Button>
      </div>

      <Dialog
        open={Boolean(pasteConfirm)}
        onOpenChange={(open) => {
          if (!open) setPasteConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste into the grid</DialogTitle>
            <DialogDescription>
              {pasteConfirm
                ? `${pasteConfirm.interpretation} Filling blank rows only would leave ${pasteConfirm.leftover} paste row(s) unused. Overwriting from the top would replace ${pasteConfirm.overwriteCount} populated row(s). Nothing is saved until you create students.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              onClick={() => {
                if (pasteConfirm) applyPaste(pasteConfirm.text, true);
              }}
            >
              Overwrite from top
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!pasteConfirm) return;
                const parsed = parseBulkAddPaste(pasteConfirm.text);
                if (!parsed) return;
                const plan = planBulkAddPasteApply({
                  currentRows: rows,
                  paste: parsed,
                  classOptions,
                  makeKey,
                  maxRows: BULK_ADD_MAX_ROWS,
                  forceOverwrite: false,
                  defaultClassId: defaultClass,
                });
                setRows(plan.nextRows);
                setShowIssues(false);
                setPasteNote(
                  `${parsed.interpretation} Filled blank rows only — nothing saved yet.`,
                );
                setPasteConfirm(null);
              }}
            >
              Fill blank rows only
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasteConfirm(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
