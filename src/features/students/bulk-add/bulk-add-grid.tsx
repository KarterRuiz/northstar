"use client";

import { Fragment } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "@/features/students/enrollment-constants";
import { cn } from "@/lib/utils";

import { BulkAddClassSelect } from "./bulk-add-class-select";
import {
  BULK_ADD_EXTERNAL_ID_MAX,
  BULK_ADD_MAX_ROWS,
  BULK_ADD_NAME_MAX,
  BULK_ADD_ROW_BATCH,
} from "./constants";
import type { BulkAddClassOption, BulkAddRowDraft, BulkAddRowIssue } from "./types";

type BulkAddGridProps = {
  rows: BulkAddRowDraft[];
  classOptions: BulkAddClassOption[];
  issuesByKey: Record<string, BulkAddRowIssue[]>;
  onChangeRow: (key: string, patch: Partial<BulkAddRowDraft>) => void;
  onAddRow: () => void;
  onAddRowBatch: () => void;
  onRemoveRow: (key: string) => void;
  onPaste: (text: string) => void;
  disabled?: boolean;
};

function statusLabel(s: string): string {
  return s.replaceAll("_", " ");
}

function fieldError(
  issues: BulkAddRowIssue[] | undefined,
  field: BulkAddRowIssue["field"],
): string | undefined {
  return issues?.find((i) => i.field === field)?.message;
}

const nativeSelectClassName = cn(
  "border-input bg-background ring-offset-background text-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 capitalize",
);

export function BulkAddGrid({
  rows,
  classOptions,
  issuesByKey,
  onChangeRow,
  onAddRow,
  onAddRowBatch,
  onRemoveRow,
  onPaste,
  disabled,
}: BulkAddGridProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[min(70vh,40rem)] overflow-auto">
          <Table>
            <TableHeader className="bg-background sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 px-2">#</TableHead>
                <TableHead className="min-w-[8rem]">First *</TableHead>
                <TableHead className="min-w-[8rem]">Last *</TableHead>
                <TableHead className="min-w-[7rem]">Preferred</TableHead>
                <TableHead className="min-w-[7rem]">Student #</TableHead>
                <TableHead className="min-w-[12rem]">Class *</TableHead>
                <TableHead className="min-w-[7rem]">Status</TableHead>
                <TableHead className="w-12 px-2">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const issues = issuesByKey[row.key];
                const hasIssues = Boolean(issues?.length);
                const rowMsg = issues?.find((i) => i.field === "row")?.message;
                const firstErr = fieldError(issues, "firstName");
                const lastErr = fieldError(issues, "lastName");
                const prefErr = fieldError(issues, "preferredName");
                const extErr = fieldError(issues, "externalId");
                const classErr = fieldError(issues, "classId");
                const statusErr = fieldError(issues, "enrollmentStatus");

                const errorSummary = [
                  rowMsg,
                  firstErr,
                  lastErr,
                  classErr,
                  extErr,
                  statusErr,
                  prefErr,
                ]
                  .filter(Boolean)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(" · ");

                return (
                  <Fragment key={row.key}>
                    <TableRow
                      className={cn(hasIssues && "bg-destructive/[0.03]")}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (
                          !text ||
                          (!text.includes("\t") && !text.includes("\n"))
                        ) {
                          return;
                        }
                        e.preventDefault();
                        onPaste(text);
                      }}
                    >
                      <TableCell className="text-muted-foreground px-2 text-xs tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={row.firstName}
                          maxLength={BULK_ADD_NAME_MAX}
                          disabled={disabled}
                          aria-label={`Row ${index + 1} first name`}
                          aria-invalid={Boolean(firstErr) || undefined}
                          className={cn(
                            "h-8 text-xs",
                            firstErr && "border-destructive",
                          )}
                          onChange={(e) =>
                            onChangeRow(row.key, { firstName: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={row.lastName}
                          maxLength={BULK_ADD_NAME_MAX}
                          disabled={disabled}
                          aria-label={`Row ${index + 1} last name`}
                          aria-invalid={Boolean(lastErr) || undefined}
                          className={cn(
                            "h-8 text-xs",
                            lastErr && "border-destructive",
                          )}
                          onChange={(e) =>
                            onChangeRow(row.key, { lastName: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={row.preferredName}
                          maxLength={BULK_ADD_NAME_MAX}
                          disabled={disabled}
                          aria-label={`Row ${index + 1} preferred name`}
                          aria-invalid={Boolean(prefErr) || undefined}
                          className={cn(
                            "h-8 text-xs",
                            prefErr && "border-destructive",
                          )}
                          onChange={(e) =>
                            onChangeRow(row.key, {
                              preferredName: e.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={row.externalId}
                          maxLength={BULK_ADD_EXTERNAL_ID_MAX}
                          disabled={disabled}
                          aria-label={`Row ${index + 1} student number`}
                          aria-invalid={Boolean(extErr) || undefined}
                          className={cn(
                            "h-8 font-mono text-xs",
                            extErr && "border-destructive",
                          )}
                          onChange={(e) =>
                            onChangeRow(row.key, { externalId: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <BulkAddClassSelect
                          id={`bulk-class-${row.key}`}
                          value={row.classId}
                          options={classOptions}
                          disabled={disabled}
                          invalid={Boolean(classErr)}
                          onChange={(classId) =>
                            onChangeRow(row.key, { classId })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <select
                          value={row.enrollmentStatus}
                          disabled={disabled}
                          aria-label={`Row ${index + 1} enrollment status`}
                          aria-invalid={Boolean(statusErr) || undefined}
                          className={cn(
                            nativeSelectClassName,
                            statusErr && "border-destructive",
                          )}
                          onChange={(e) =>
                            onChangeRow(row.key, {
                              enrollmentStatus: e.target
                                .value as EnrollmentStatusForm,
                            })
                          }
                        >
                          {ENROLLMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={disabled || rows.length <= 1}
                          aria-label={`Remove row ${index + 1}`}
                          onClick={() => onRemoveRow(row.key)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {errorSummary ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={8}
                          className="bg-destructive/5 px-3 py-1.5"
                        >
                          <p className="text-destructive text-xs" role="alert">
                            {errorSummary}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || rows.length >= BULK_ADD_MAX_ROWS}
          onClick={onAddRow}
        >
          <Plus className="size-3.5" aria-hidden />
          Add row
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled || rows.length + BULK_ADD_ROW_BATCH > BULK_ADD_MAX_ROWS
          }
          onClick={onAddRowBatch}
        >
          Add {BULK_ADD_ROW_BATCH} more rows
        </Button>
        <p className="text-muted-foreground text-xs">
          {rows.length} / {BULK_ADD_MAX_ROWS} rows · Paste from Excel/Sheets into
          any cell
        </p>
      </div>
    </div>
  );
}
