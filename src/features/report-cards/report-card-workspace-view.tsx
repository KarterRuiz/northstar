"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";
import { formatOverallGrade } from "@/features/teacher/gradebook/calculations";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import type { ReportReadinessStatus } from "@/features/teacher/gradebook/report-readiness";
import { REPORT_CARD_TERMS, type ReportCardTerm } from "@/lib/report-cards/constants";

import { ReportCardCommentForm } from "./report-card-comment-form";
import {
  reportReadinessStatusLabel,
  transitionNoteStatusLabel,
} from "@/features/teacher/gradebook/report-readiness";
import type { ReportCardWorkspaceStudentRow } from "./types";

const BASE = "/dashboard/teacher/report-cards";

type StatusFilter = "all" | "ready" | "needs_action";

function readinessBadgeVariant(
  status: ReportReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "needs_grades") return "destructive";
  if (status === "missing_transition_note") return "secondary";
  return "outline";
}

function commentBadgeVariant(
  status: "draft" | "complete" | null,
): "default" | "secondary" | "outline" {
  if (status === "complete") return "default";
  if (status === "draft") return "secondary";
  return "outline";
}

function needsAction(row: ReportCardWorkspaceStudentRow): boolean {
  return row.readinessStatus !== "ready" || row.comment?.status !== "complete";
}

type ReportCardWorkspaceViewProps = {
  classes: { id: string; label: string; schoolYearLabel: string }[];
  classId: string | null;
  className: string | null;
  classSubtitle: string | null;
  schoolYearLabel: string | null;
  term: ReportCardTerm;
  students: ReportCardWorkspaceStudentRow[];
};

export function ReportCardWorkspaceView({
  classes,
  classId,
  className,
  classSubtitle,
  schoolYearLabel,
  term,
  students,
}: ReportCardWorkspaceViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [expandedStudentId, setExpandedStudentId] = React.useState<string | null>(
    null,
  );

  function pushParams(next: { classId?: string; term?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.classId !== undefined) {
      if (next.classId) params.set("classId", next.classId);
      else params.delete("classId");
    }
    if (next.term !== undefined) params.set("term", next.term);
    router.push(`${BASE}?${params.toString()}`);
  }

  const filtered = students.filter((row) => {
    if (statusFilter === "ready") return row.readinessStatus === "ready";
    if (statusFilter === "needs_action") return needsAction(row);
    return true;
  });

  const readyCount = students.filter((r) => r.readinessStatus === "ready").length;
  const commentCompleteCount = students.filter(
    (r) => r.comment?.status === "complete",
  ).length;

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-8 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Report cards"
        description="Review readiness, enter narrative comments, generate print-ready report cards, save PDFs to student records, or upload official PDFs manually."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`${BASE}#report-card-upload`}>
              <FileText className="mr-1.5 size-3.5" />
              Upload PDFs
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label htmlFor="rc-class" className="text-xs font-medium">
            Class
          </label>
          <select
            id="rc-class"
            className={selectClassName}
            value={classId ?? ""}
            onChange={(e) => pushParams({ classId: e.target.value })}
          >
            <option value="">Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="rc-term" className="text-xs font-medium">
            Term
          </label>
          <select
            id="rc-term"
            className={selectClassName}
            value={term}
            onChange={(e) => pushParams({ term: e.target.value })}
            disabled={!classId}
          >
            {REPORT_CARD_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="rc-filter" className="text-xs font-medium">
            Show
          </label>
          <select
            id="rc-filter"
            className={selectClassName}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            disabled={!classId}
          >
            <option value="all">All students</option>
            <option value="ready">Ready only</option>
            <option value="needs_action">Needs action</option>
          </select>
        </div>
      </div>

      {!classId ? (
        <p className="text-muted-foreground text-sm">
          Choose a class to see the roster, readiness, and narrative comments for the
          selected term.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-medium tracking-tight">{className}</h2>
            {classSubtitle ? (
              <p className="text-muted-foreground text-sm">{classSubtitle}</p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {readyCount} of {students.length} ready · {commentCompleteCount} comments
              complete · School year {schoolYearLabel} · Term {term}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="max-h-[min(70vh,calc(100dvh-12rem))] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/80 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Readiness</TableHead>
                    <TableHead>Running grade</TableHead>
                    <TableHead>Transition note</TableHead>
                    <TableHead>Report card PDF</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead className="w-[7rem]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No students match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <React.Fragment key={row.studentId}>
                        <TableRow>
                          <TableCell className="font-medium">
                            {row.displayName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={readinessBadgeVariant(row.readinessStatus)}
                              className="text-[10px]"
                            >
                              {reportReadinessStatusLabel[row.readinessStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {row.overallPercent !== null ? (
                              formatOverallGrade({
                                percent: row.overallPercent,
                                letter: row.overallLetter,
                                isPartial: row.isPartialGrade,
                              })
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {transitionNoteStatusLabel[row.transitionNoteStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.missingReportCardTerms.length > 0 ? (
                              <span className="text-amber-900 dark:text-amber-100">
                                Missing {row.missingReportCardTerms.join(", ")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Final PDF</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={commentBadgeVariant(row.comment?.status ?? null)}
                              className="text-[10px]"
                            >
                              {row.comment?.status === "complete"
                                ? "Complete"
                                : row.comment?.status === "draft"
                                  ? "Draft"
                                  : "Not started"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  setExpandedStudentId((id) =>
                                    id === row.studentId ? null : row.studentId,
                                  )
                                }
                              >
                                {expandedStudentId === row.studentId
                                  ? "Hide"
                                  : "Comment"}
                              </Button>
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                <Link
                                  href={`${BASE}/preview/${row.studentId}?classId=${classId}&term=${term}`}
                                  target="_blank"
                                >
                                  Preview
                                  <ExternalLink className="ml-1 size-3" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedStudentId === row.studentId && classId ? (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="py-4">
                              <ReportCardCommentForm
                                key={
                                  row.comment?.updatedAt ??
                                  `${row.studentId}-${term}-new`
                                }
                                studentId={row.studentId}
                                classId={classId}
                                term={term}
                                initialComment={row.comment}
                                compact
                              />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Readiness uses gradebook scores, transition notes, and uploaded final PDFs
            (same rules as the gradebook Report readiness tab). Narrative comments are
            saved per class, school year, and term.
          </p>
        </>
      )}
    </div>
  );
}
