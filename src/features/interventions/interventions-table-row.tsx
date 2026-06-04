"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatOverallGrade } from "@/features/teacher/gradebook/calculations";
import { formatInterventionUpdatedAt } from "./format-intervention-date";

import {
  escalateInterventionAction,
  resolveInterventionAction,
} from "./actions";
import { INTERVENTIONS_TABLE_STICKY } from "./interventions-table-sticky";
import { formatMissingWorkCount } from "./academic-flags";
import {
  AcademicFlagsList,
  FollowUpDashboardBadge,
  InterventionSeverityBadge,
  InterventionStatusBadge,
} from "./intervention-badges";
import { getFollowUpDashboardStatus } from "./follow-up-status";
import { formatInterventionDate } from "./format-intervention-date";
import {
  applyEscalatedIntervention,
  applyResolvedIntervention,
} from "./optimistic-row-updates";
import { interventionTypeLabels } from "./schema";
import type { InterventionsDashboardStudentRow } from "./types";

const BASE = "/dashboard/teacher";

type InterventionsTableRowProps = {
  row: InterventionsDashboardStudentRow;
  onAddIntervention: (row: InterventionsDashboardStudentRow) => void;
  onRowChange: (next: InterventionsDashboardStudentRow) => void;
  onFeedback: (kind: "success" | "error", message: string) => void;
  onRevalidate: () => void;
};

type RowActionsProps = {
  row: InterventionsDashboardStudentRow;
  profileHref: string;
  hasOpenIntervention: boolean;
  pending: boolean;
  onAddIntervention: (row: InterventionsDashboardStudentRow) => void;
  onResolve: () => void;
  onEscalate: () => void;
  layout: "inline" | "menu";
};

function InterventionsRowActions({
  row,
  profileHref,
  hasOpenIntervention,
  pending,
  onAddIntervention,
  onResolve,
  onEscalate,
  layout,
}: RowActionsProps) {
  if (layout === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Actions for ${row.displayName}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={profileHref}>Open profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddIntervention(row)}>
            Add intervention
          </DropdownMenuItem>
          {hasOpenIntervention ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={pending} onClick={onResolve}>
                Resolve
              </DropdownMenuItem>
              <DropdownMenuItem disabled={pending} onClick={onEscalate}>
                Escalate
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button asChild variant="ghost" size="sm" className="h-8 px-2.5">
        <Link href={profileHref}>Open</Link>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 px-2.5"
        onClick={() => onAddIntervention(row)}
      >
        Add
      </Button>
      {hasOpenIntervention ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            disabled={pending}
            onClick={onResolve}
          >
            Resolve
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            disabled={pending}
            onClick={onEscalate}
          >
            Escalate
          </Button>
        </>
      ) : null}
    </div>
  );
}

function InterventionsTableRowInner({
  row,
  onAddIntervention,
  onRowChange,
  onFeedback,
  onRevalidate,
}: InterventionsTableRowProps) {
  const [pending, startTransition] = React.useTransition();
  const profileHref = `${BASE}/students/${row.studentId}/interventions`;

  const gradeLabel =
    row.overallPercent !== null
      ? formatOverallGrade({
          percent: row.overallPercent,
          letter: row.overallLetter,
          isPartial: row.isPartialGrade,
        })
      : "—";

  function runStatus(
    action: typeof resolveInterventionAction | typeof escalateInterventionAction,
    optimistic: () => InterventionsDashboardStudentRow,
    successMessage: string,
  ) {
    const active = row.activeIntervention;
    if (!active) return;

    const previous = row;
    onRowChange(optimistic());

    startTransition(async () => {
      const result = await action({
        interventionId: active.id,
        studentId: row.studentId,
      });
      if (result.ok) {
        onFeedback("success", successMessage);
        onRevalidate();
        return;
      }
      onRowChange(previous);
      onFeedback("error", result.message);
    });
  }

  const lastUpdate = row.lastUpdate
    ? formatInterventionUpdatedAt(row.lastUpdate)
    : "—";

  const hasOpenIntervention =
    row.activeIntervention && row.activeIntervention.status !== "resolved";

  const followUpStatus = row.activeIntervention
    ? getFollowUpDashboardStatus(row.activeIntervention.followUpDate)
    : "none";

  const onResolve = () =>
    runStatus(
      resolveInterventionAction,
      () => applyResolvedIntervention(row),
      "Marked as resolved",
    );

  const onEscalate = () =>
    runStatus(
      escalateInterventionAction,
      () => applyEscalatedIntervention(row),
      "Escalated for follow-up",
    );

  const actionProps = {
    row,
    profileHref,
    hasOpenIntervention: !!hasOpenIntervention,
    pending,
    onAddIntervention,
    onResolve,
    onEscalate,
  };

  return (
    <TableRow className="group [&>td]:py-3">
      <TableCell
        className={cn(
          "font-medium",
          INTERVENTIONS_TABLE_STICKY.studentCell,
          INTERVENTIONS_TABLE_STICKY.edgeLeft,
        )}
      >
        <Link
          href={profileHref}
          className="text-primary underline-offset-4 hover:underline"
        >
          {row.displayName}
        </Link>
        <p className="text-muted-foreground mt-0.5 text-xs lg:hidden">{row.classLabel}</p>
      </TableCell>
      <TableCell className="tabular-nums">{gradeLabel}</TableCell>
      <TableCell
        className="text-sm tabular-nums"
        aria-label={`Missing work: ${formatMissingWorkCount(row.missingAssignmentCount)}`}
      >
        <span
          className={
            row.missingAssignmentCount > 0
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          }
        >
          {formatMissingWorkCount(row.missingAssignmentCount)}
        </span>
      </TableCell>
      <TableCell aria-label="Academic flags">
        {row.flags.length > 0 ? (
          <AcademicFlagsList flags={row.flags} />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[12rem]" aria-label="Current support">
        {row.activeIntervention && row.activeIntervention.status !== "resolved" ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span
              className="truncate text-sm font-medium"
              title={row.activeIntervention.title}
            >
              {interventionTypeLabels[row.activeIntervention.interventionType]}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <InterventionSeverityBadge severity={row.activeIntervention.severity} />
              <FollowUpDashboardBadge status={followUpStatus} />
            </div>
            {row.activeIntervention.followUpDate ? (
              <p className="text-muted-foreground text-xs">
                Follow-up {formatInterventionDate(row.activeIntervention.followUpDate)}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No active support</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{lastUpdate}</TableCell>
      <TableCell>
        <InterventionStatusBadge status={row.status} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right",
          INTERVENTIONS_TABLE_STICKY.actionsCell,
          INTERVENTIONS_TABLE_STICKY.edgeRight,
        )}
      >
        <div className="hidden md:block">
          <InterventionsRowActions {...actionProps} layout="inline" />
        </div>
        <div className="flex justify-end md:hidden">
          <InterventionsRowActions {...actionProps} layout="menu" />
        </div>
      </TableCell>
    </TableRow>
  );
}

export const InterventionsTableRow = React.memo(InterventionsTableRowInner);
