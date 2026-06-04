"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { siteConfig } from "@/config/site";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";

import { CreateInterventionSheet } from "./create-intervention-sheet";
import {
  interventionDashboardFilterLabels,
  isInterventionDashboardFilter,
  rowMatchesInterventionDashboardFilter,
  type InterventionDashboardFilter,
} from "./intervention-dashboard-filters";
import { InterventionsTableRow } from "./interventions-table-row";
import {
  applyCreatedIntervention,
  buildOptimisticIntervention,
} from "./optimistic-row-updates";
import {
  interventionStatuses,
  interventionTypes,
  interventionStatusLabels,
  interventionTypeLabels,
} from "./schema";
import type {
  InterventionsDashboardStudentRow,
  InterventionsDashboardSummary,
} from "./types";

const BASE = "/dashboard/teacher/interventions";

/** Sticky header cells — applied per `th` so headers stay visible inside the scroll container. */
const STICKY_TABLE_HEAD =
  "bg-muted/95 supports-[backdrop-filter]:bg-muted/80 sticky top-0 z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-sm";

import { INTERVENTIONS_TABLE_STICKY } from "./interventions-table-sticky";

type InterventionsDashboardViewProps = {
  classes: { id: string; label: string; gradeName: string }[];
  classId: string | null;
  rows: InterventionsDashboardStudentRow[];
  summary: InterventionsDashboardSummary;
};

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function InterventionsDashboardView({
  classes,
  classId,
  rows: initialRows,
  summary,
}: InterventionsDashboardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast } = useWorkspaceToast();
  const alertFilterParam = searchParams.get("filter");
  const alertFilter: InterventionDashboardFilter | null =
    isInterventionDashboardFilter(alertFilterParam) ? alertFilterParam : null;
  const [rowOverrides, setRowOverrides] = React.useState<
    Record<string, InterventionsDashboardStudentRow>
  >({});
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [gradeFilter, setGradeFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sheetTarget, setSheetTarget] =
    React.useState<InterventionsDashboardStudentRow | null>(null);

  const revalidateQuietly = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const displayRows = React.useMemo(
    () =>
      initialRows.map((row) => {
        const key = `${row.classId}-${row.studentId}`;
        const override = rowOverrides[key];
        if (!override) return row;
        if (
          override.status === row.status &&
          override.lastUpdate === row.lastUpdate &&
          override.activeIntervention?.id === row.activeIntervention?.id &&
          override.activeIntervention?.status === row.activeIntervention?.status
        ) {
          return row;
        }
        return override;
      }),
    [initialRows, rowOverrides],
  );

  function patchRow(
    studentId: string,
    rowClassId: string,
    patch: (row: InterventionsDashboardStudentRow) => InterventionsDashboardStudentRow,
  ) {
    const key = `${rowClassId}-${studentId}`;
    setRowOverrides((prev) => {
      const base =
        prev[key] ?? initialRows.find((r) => r.studentId === studentId && r.classId === rowClassId);
      if (!base) return prev;
      return { ...prev, [key]: patch(base) };
    });
  }

  function pushClass(nextClassId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextClassId) params.set("classId", nextClassId);
    else params.delete("classId");
    router.push(params.toString() ? `${BASE}?${params}` : BASE);
  }

  const gradeLevels = [...new Set(displayRows.map((r) => r.gradeName))].sort();

  const filtered = displayRows.filter((row) => {
    if (classId && row.classId !== classId) return false;
    if (alertFilter && !rowMatchesInterventionDashboardFilter(row, alertFilter)) {
      return false;
    }
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (
      typeFilter !== "all" &&
      row.activeIntervention?.interventionType !== typeFilter
    ) {
      return false;
    }
    if (gradeFilter !== "all" && row.gradeName !== gradeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!row.displayName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-8 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Interventions"
        description="Teacher-first support workflow: academic flags from gradebook data, active interventions, and quick follow-ups across your classes."
      />

      <WorkspaceToast toast={toast} />

      {alertFilter ? (
        <p className="text-muted-foreground text-sm">
          Showing:{" "}
          <span className="text-foreground font-medium">
            {interventionDashboardFilterLabels[alertFilter]}
          </span>
          {" · "}
          <Button
            type="button"
            variant="link"
            className="text-primary h-auto p-0 text-sm"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("filter");
              router.push(params.toString() ? `${BASE}?${params}` : BASE);
            }}
          >
            Clear filter
          </Button>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Active interventions" value={summary.activeInterventions} />
        <SummaryCard label="Students flagged" value={summary.studentsFlagged} />
        <SummaryCard label="Missing work alerts" value={summary.missingWorkAlerts} />
        <SummaryCard label="Academic risk alerts" value={summary.academicRiskAlerts} />
        <SummaryCard label="Enrichment candidates" value={summary.enrichmentCandidates} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label htmlFor="iv-class" className="text-xs font-medium">
            Class
          </label>
          <select
            id="iv-class"
            className={selectClassName}
            value={classId ?? ""}
            onChange={(e) => pushClass(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="iv-status" className="text-xs font-medium">
            Status
          </label>
          <select
            id="iv-status"
            className={selectClassName}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {interventionStatuses.map((s) => (
              <option key={s} value={s}>
                {interventionStatusLabels[s]}
              </option>
            ))}
            <option value="none">No intervention</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="iv-type" className="text-xs font-medium">
            Intervention type
          </label>
          <select
            id="iv-type"
            className={selectClassName}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All</option>
            {interventionTypes.map((t) => (
              <option key={t} value={t}>
                {interventionTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="iv-grade" className="text-xs font-medium">
            Grade level
          </label>
          <select
            id="iv-grade"
            className={selectClassName}
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="all">All</option>
            {gradeLevels.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label htmlFor="iv-search" className="text-xs font-medium">
            Search student
          </label>
          <Input
            id="iv-search"
            placeholder="Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[min(70vh,calc(100dvh-12rem))] overflow-auto overscroll-contain isolate md:max-h-[min(72vh,calc(100dvh-14rem))]"
          role="region"
          aria-label="Interventions student list"
        >
          <table
            className="w-full min-w-[44rem] caption-bottom text-sm"
            aria-label="Interventions by student"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  scope="col"
                  className={cn(
                    STICKY_TABLE_HEAD,
                    INTERVENTIONS_TABLE_STICKY.studentHead,
                    INTERVENTIONS_TABLE_STICKY.edgeLeft,
                  )}
                >
                  Student
                </TableHead>
                <TableHead
                  scope="col"
                  className={cn(STICKY_TABLE_HEAD, "whitespace-nowrap")}
                >
                  Current grade
                </TableHead>
                <TableHead
                  scope="col"
                  className={cn(STICKY_TABLE_HEAD, "whitespace-nowrap")}
                >
                  Missing work
                </TableHead>
                <TableHead scope="col" className={cn(STICKY_TABLE_HEAD, "min-w-[9rem]")}>
                  Flags
                </TableHead>
                <TableHead scope="col" className={cn(STICKY_TABLE_HEAD, "min-w-[9rem]")}>
                  Current support
                </TableHead>
                <TableHead
                  scope="col"
                  className={cn(STICKY_TABLE_HEAD, "whitespace-nowrap")}
                >
                  Last update
                </TableHead>
                <TableHead
                  scope="col"
                  className={cn(STICKY_TABLE_HEAD, "whitespace-nowrap")}
                >
                  Status
                </TableHead>
                <TableHead
                  scope="col"
                  className={cn(
                    STICKY_TABLE_HEAD,
                    INTERVENTIONS_TABLE_STICKY.actionsHead,
                    INTERVENTIONS_TABLE_STICKY.edgeRight,
                    "text-right",
                  )}
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-10 text-center text-sm">
                    No students match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <InterventionsTableRow
                    key={`${row.classId}-${row.studentId}`}
                    row={row}
                    onAddIntervention={setSheetTarget}
                    onRowChange={(next) =>
                      patchRow(row.studentId, row.classId, () => next)
                    }
                    onFeedback={showToast}
                    onRevalidate={revalidateQuietly}
                  />
                ))
              )}
            </TableBody>
          </table>
        </div>
      </div>

      {sheetTarget ? (
        <CreateInterventionSheet
          open={!!sheetTarget}
          onOpenChange={(open) => {
            if (!open) setSheetTarget(null);
          }}
          studentId={sheetTarget.studentId}
          classId={sheetTarget.classId}
          studentName={sheetTarget.displayName}
          onCreated={(interventionId, input) => {
            const target = sheetTarget;
            if (target) {
              const intervention = buildOptimisticIntervention(
                interventionId,
                target.studentId,
                target.classId,
                input,
              );
              patchRow(target.studentId, target.classId, (row) =>
                applyCreatedIntervention(row, intervention),
              );
            }
            setSheetTarget(null);
            showToast("success", "Intervention added");
            revalidateQuietly();
          }}
        />
      ) : null}
    </div>
  );
}
