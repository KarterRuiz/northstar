"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";

import { formatOverallGrade } from "./calculations";
import { buildScoreMap, groupScoresByStudentId, scoresForStudent } from "./gradebook-utils";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
  GradebookReportReadinessByStudent,
  GradebookScoreRow,
  GradebookStudentRow,
} from "./load-gradebook-data";
import {
  computeStudentReportReadiness,
  reportReadinessStatusLabel,
  transitionNoteStatusLabel,
  type ReportReadinessStatus,
  type TransitionNoteStatus,
} from "./report-readiness";
import type { AssignmentForCalc, CategoryForCalc } from "./calculations";

function readinessBadgeVariant(
  status: ReportReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "needs_grades") return "destructive";
  if (status === "missing_transition_note") return "secondary";
  return "outline";
}

function transitionBadgeVariant(
  status: TransitionNoteStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "submitted") return "default";
  if (status === "draft") return "secondary";
  return "destructive";
}

type GradebookReportReadinessProps = {
  students: GradebookStudentRow[];
  categories: GradebookCategoryRow[];
  assignments: GradebookAssignmentRow[];
  scores: GradebookScoreRow[];
  assignmentsForCalc: AssignmentForCalc[];
  categoriesForCalc: CategoryForCalc[];
  termFilter: string;
  schoolYearLabel: string;
  reportReadinessByStudent: GradebookReportReadinessByStudent;
};

export function GradebookReportReadiness({
  students,
  categories,
  assignments,
  scores,
  assignmentsForCalc,
  categoriesForCalc,
  termFilter,
  schoolYearLabel,
  reportReadinessByStudent,
}: GradebookReportReadinessProps) {
  const scoresByStudentId = React.useMemo(
    () => groupScoresByStudentId(scores),
    [scores],
  );

  if (students.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No students to review.
      </p>
    );
  }

  const readyCount = students.filter((st) => {
    const ctx = reportReadinessByStudent[st.studentId] ?? {
      transitionNoteStatus: "missing" as const,
      reportCardFinalTerms: [],
    };
    const scoreMap = buildScoreMap(scoresForStudent(scoresByStudentId, st.studentId));
    return (
      computeStudentReportReadiness({
        studentId: st.studentId,
        categories,
        assignments,
        assignmentsForCalc,
        categoriesForCalc,
        scoresByAssignmentId: scoreMap,
        termFilter,
        context: ctx,
      }).status === "ready"
    );
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          School year <span className="text-foreground font-medium">{schoolYearLabel}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {readyCount} of {students.length} ready
        </span>
        {termFilter ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Term <span className="text-foreground font-medium">{termFilter}</span>
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Report cards: all terms ({REPORT_CARD_TERMS.join(", ")})
            </span>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[min(60vh,calc(100dvh-14rem))] overflow-auto overscroll-contain">
          <div className="overflow-x-auto overscroll-x-contain">
          <Table className="min-w-[48rem]">
            <TableHeader className="bg-muted/80 sticky top-0 z-10">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Running grade</TableHead>
                <TableHead>Missing assignments</TableHead>
                <TableHead>Categories w/o scores</TableHead>
                <TableHead>Transition note</TableHead>
                <TableHead>Report card ({schoolYearLabel})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((st) => {
                const ctx = reportReadinessByStudent[st.studentId] ?? {
                  transitionNoteStatus: "missing" as const,
                  reportCardFinalTerms: [],
                };
                const scoreMap = buildScoreMap(
                  scoresForStudent(scoresByStudentId, st.studentId),
                );
                const row = computeStudentReportReadiness({
                  studentId: st.studentId,
                  categories,
                  assignments,
                  assignmentsForCalc,
                  categoriesForCalc,
                  scoresByAssignmentId: scoreMap,
                  termFilter,
                  context: ctx,
                });

                return (
                  <TableRow key={st.studentId}>
                    <TableCell className="font-medium">{st.displayName}</TableCell>
                    <TableCell>
                      <Badge variant={readinessBadgeVariant(row.status)} className="text-[10px]">
                        {reportReadinessStatusLabel[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.overallPercent !== null ? (
                        <>
                          {formatOverallGrade({
                            percent: row.overallPercent,
                            letter: row.overallLetter,
                            isPartial: row.isPartialGrade,
                          })}
                          {row.isPartialGrade ? (
                            <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                              partial
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.missingAssignmentCount > 0 ? (
                        <span className="text-destructive font-medium">
                          {row.missingAssignmentCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[10rem] text-xs">
                      {row.categoriesWithoutScores.length > 0 ? (
                        <span className="text-amber-900 dark:text-amber-100">
                          {row.categoriesWithoutScores.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transitionBadgeVariant(row.transitionNoteStatus)}
                        className="text-[10px]"
                      >
                        {transitionNoteStatusLabel[row.transitionNoteStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.missingReportCardTerms.length > 0 ? (
                        <span>
                          Missing{" "}
                          <span className="font-medium">
                            {row.missingReportCardTerms.join(", ")}
                          </span>
                          {row.reportCardFinalTerms.length > 0 ? (
                            <span className="text-muted-foreground block">
                              Have final: {row.reportCardFinalTerms.join(", ")}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Final PDF
                          {row.reportCardFinalTerms.length > 0
                            ? ` (${row.reportCardFinalTerms.join(", ")})`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Preview only — uses gradebook scores, transition notes, and uploaded report card files.
        {termFilter
          ? ` Grades and report cards are scoped to term ${termFilter}.`
          : " With no term filter, all assignments and all report card terms are required for Ready."}
      </p>
    </div>
  );
}
