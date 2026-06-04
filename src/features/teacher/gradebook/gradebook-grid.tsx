"use client";

import * as React from "react";
import { TableProperties, Users } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { cn } from "@/lib/utils";

import {
  categoryAveragePercent,
  formatPercent,
  overallGradeMeta,
  type AssignmentForCalc,
  type CategoryForCalc,
} from "./calculations";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
  GradebookScoreRow,
  GradebookStudentRow,
} from "./load-gradebook-data";
import { GradebookAssignmentMenu } from "./gradebook-assignment-menu";
import { GradebookScoreCellEditor } from "./gradebook-score-cell-editor";
import {
  buildScoreMap,
  groupScoresByStudentId,
  scoreKey,
  scoresForStudent,
  type ScoreDraftRow,
} from "./gradebook-utils";
import {
  GradebookGridNavigationProvider,
  useGradebookGridNavigationOptional,
  type EditableColumn,
} from "./use-gradebook-grid-navigation";
import { GRADEBOOK_GRID_STICKY } from "./gradebook-grid-sticky";

const SCORE_COL =
  "min-w-[4.75rem] w-[4.75rem] max-w-[4.75rem] md:min-w-[5rem] md:w-[5rem] md:max-w-[5rem]";
const ASSIGN_COL =
  "min-w-[5.25rem] w-[5.25rem] max-w-[5.25rem] md:min-w-[5.5rem] md:w-[5.5rem] md:max-w-[5.5rem]";
const SCORE_CELL =
  "border-border/60 border-b border-r px-1 py-0 text-center align-middle tabular-nums";
const OVERALL_COL =
  "bg-muted border-border border-l-2 font-semibold text-foreground";
const OVERALL_HEADER = cn(
  GRADEBOOK_GRID_STICKY.headerRow,
  OVERALL_COL,
  "border-r-0 text-center",
);

function formatGradebookDisplayDate(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return trimmed;
}

type GridColumn =
  | { kind: "assignment"; assignment: GradebookAssignmentRow; categoryName: string }
  | { kind: "categoryAvg"; category: GradebookCategoryRow };

type GradebookGridProps = {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  students: GradebookStudentRow[];
  categories: GradebookCategoryRow[];
  assignments: GradebookAssignmentRow[];
  scores: GradebookScoreRow[];
  termFilter: string;
  assignmentsForCalc: AssignmentForCalc[];
  categoriesForCalc: CategoryForCalc[];
  busy: boolean;
  cellSaveState: Record<string, "saving" | "saved" | "error">;
  onCellSave: (
    assignmentId: string,
    studentId: string,
    draft: ScoreDraftRow,
  ) => Promise<void>;
  onOpenScoreEntry: (assignmentId: string) => void;
  onEditAssignment: (assignment: GradebookAssignmentRow) => void;
  onDeleteAssignment: (assignment: GradebookAssignmentRow) => void;
  onColumnPaste: (
    assignmentId: string,
    startRowIndex: number,
    drafts: ScoreDraftRow[],
  ) => void | Promise<void>;
  onPasteRejected?: (message: string) => void;
};

/** Column index map — built once per column set, not per student row. */
function buildAssignmentColIndex(columns: GridColumn[]): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const col of columns) {
    if (col.kind === "assignment") {
      map.set(col.assignment.id, idx);
      idx += 1;
    }
  }
  return map;
}

function buildEditableColumns(columns: GridColumn[]): EditableColumn[] {
  const editable: EditableColumn[] = [];
  let colIndex = 0;
  for (const col of columns) {
    if (col.kind === "assignment") {
      editable.push({
        colIndex,
        assignmentId: col.assignment.id,
        pointsPossible: col.assignment.pointsPossible,
      });
      colIndex += 1;
    }
  }
  return editable;
}

function buildColumns(
  categories: GradebookCategoryRow[],
  assignments: GradebookAssignmentRow[],
  termFilter: string,
): GridColumn[] {
  const filtered = termFilter
    ? assignments.filter((a) => a.term === termFilter)
    : assignments;
  const columns: GridColumn[] = [];
  const sortedCategories = [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  for (const cat of sortedCategories) {
    const catAssignments = filtered
      .filter((a) => a.categoryId === cat.id)
      .sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          a.title.localeCompare(b.title),
      );
    for (const a of catAssignments) {
      columns.push({ kind: "assignment", assignment: a, categoryName: cat.name });
    }
    if (catAssignments.length > 0) {
      columns.push({ kind: "categoryAvg", category: cat });
    }
  }
  return columns;
}

function assignmentIdsInView(
  assignments: GradebookAssignmentRow[],
  termFilter: string,
): Set<string> {
  const filtered = termFilter
    ? assignments.filter((a) => a.term === termFilter)
    : assignments;
  return new Set(filtered.map((a) => a.id));
}

type StudentGridRowProps = {
  student: GradebookStudentRow;
  rowIndex: number;
  columns: GridColumn[];
  assignmentColIndex: Map<string, number>;
  studentScores: GradebookScoreRow[];
  assignmentsForCalc: AssignmentForCalc[];
  categoriesForCalc: CategoryForCalc[];
  termFilter: string;
  cellSaveState: Record<string, "saving" | "saved" | "error">;
  onCellSave: GradebookGridProps["onCellSave"];
};

function StudentGridRow({
  student,
  rowIndex,
  columns,
  assignmentColIndex,
  studentScores,
  assignmentsForCalc,
  categoriesForCalc,
  termFilter,
  cellSaveState,
  onCellSave,
}: StudentGridRowProps) {
  const scoreMap = React.useMemo(
    () => buildScoreMap(studentScores),
    [studentScores],
  );

  const overall = React.useMemo(
    () =>
      overallGradeMeta({
        categories: categoriesForCalc,
        assignments: assignmentsForCalc,
        scoresByAssignmentId: scoreMap,
        studentId: student.studentId,
        termFilter: termFilter || null,
      }),
    [
      categoriesForCalc,
      assignmentsForCalc,
      scoreMap,
      student.studentId,
      termFilter,
    ],
  );

  const categoryAvgs = React.useMemo(() => {
    const avgs = new Map<string, number | null>();
    for (const col of columns) {
      if (col.kind !== "categoryAvg") continue;
      avgs.set(
        col.category.id,
        categoryAveragePercent({
          assignments: assignmentsForCalc,
          scoresByAssignmentId: scoreMap,
          studentId: student.studentId,
          categoryId: col.category.id,
          termFilter: termFilter || null,
        }),
      );
    }
    return avgs;
  }, [
    columns,
    assignmentsForCalc,
    scoreMap,
    student.studentId,
    termFilter,
  ]);

  const scoresByAssignment = React.useMemo(() => {
    const map = new Map<string, GradebookScoreRow>();
    for (const s of studentScores) {
      map.set(s.assignmentId, s);
    }
    return map;
  }, [studentScores]);

  return (
    <tr className="group">
      <td
        className={cn(
          GRADEBOOK_GRID_STICKY.studentBody,
          GRADEBOOK_GRID_STICKY.edgeFrozenColumn,
          "px-3 py-1 text-xs font-medium whitespace-nowrap",
        )}
      >
        {student.displayName}
      </td>
      {columns.map((col, i) => {
        if (col.kind === "assignment") {
          const key = scoreKey(col.assignment.id, student.studentId);
          const colIdx = assignmentColIndex.get(col.assignment.id) ?? 0;
          return (
            <GradebookScoreCellEditor
              key={key}
              className={cn(SCORE_CELL, SCORE_COL)}
              assignment={col.assignment}
              studentId={student.studentId}
              rowIndex={rowIndex}
              colIndex={colIdx}
              score={scoresByAssignment.get(col.assignment.id)}
              saveState={cellSaveState[key]}
              onSave={(draft) => onCellSave(col.assignment.id, student.studentId, draft)}
            />
          );
        }
        const catAvg = categoryAvgs.get(col.category.id) ?? null;
        return (
          <td
            key={`avg-${col.category.id}-${i}`}
            className={cn(
              SCORE_CELL,
              SCORE_COL,
              "bg-muted text-[11px] font-medium",
            )}
          >
            {formatPercent(catAvg, 0)}
          </td>
        );
      })}
      <td
        className={cn(
          SCORE_CELL,
          SCORE_COL,
          OVERALL_COL,
          "border-r-0 px-1.5 py-1",
        )}
      >
        {overall.percent !== null ? (
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[11px]">{formatPercent(overall.percent, 0)}</span>
            {overall.letter ? (
              <span className="text-[10px]">{overall.letter}</span>
            ) : null}
            {overall.isPartial ? (
              <span
                className="text-muted-foreground mt-0.5 text-[8px] font-normal leading-none"
                title="Running grade"
              >
                running
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground font-normal">—</span>
        )}
      </td>
    </tr>
  );
}

function studentGridRowPropsEqual(
  prev: StudentGridRowProps,
  next: StudentGridRowProps,
): boolean {
  return (
    prev.student === next.student &&
    prev.rowIndex === next.rowIndex &&
    prev.columns === next.columns &&
    prev.assignmentColIndex === next.assignmentColIndex &&
    prev.studentScores === next.studentScores &&
    prev.assignmentsForCalc === next.assignmentsForCalc &&
    prev.categoriesForCalc === next.categoriesForCalc &&
    prev.termFilter === next.termFilter &&
    prev.cellSaveState === next.cellSaveState &&
    prev.onCellSave === next.onCellSave
  );
}

const MemoStudentGridRow = React.memo(StudentGridRow, studentGridRowPropsEqual);

function GridEmpty({
  students,
  categories,
  assignments,
  termFilter,
}: Pick<
  GradebookGridProps,
  "students" | "categories" | "assignments" | "termFilter"
>) {
  if (students.length === 0) {
    return (
      <ListEmptyState
        icon={Users}
        title="No students in this class"
        description="Active enrollments appear here. Add students from the class roster, then return to enter scores."
      />
    );
  }

  const termHasAssignments =
    Boolean(termFilter) && assignments.some((a) => a.term === termFilter);

  if (termFilter && assignments.length > 0 && !termHasAssignments) {
    return (
      <ListEmptyState
        icon={TableProperties}
        title={`No assignments for ${termFilter}`}
        description="Change the term filter above or assign a term when creating assignments."
      />
    );
  }

  if (categories.length === 0) {
    return (
      <ListEmptyState
        icon={TableProperties}
        title="Set up categories first"
        description="Use Manage categories in the toolbar to add weighted categories, then create assignments."
      />
    );
  }

  return (
    <ListEmptyState
      icon={TableProperties}
      title="No assignments yet"
      description="Create an assignment with New assignment, or open the Assignments tab. Columns appear here once assignments are added."
    />
  );
}

function GradebookAssignmentColumnHeader({
  assignment,
  categoryName,
  busy,
  onEditAssignment,
  onDeleteAssignment,
  onOpenScoreEntry,
}: {
  assignment: GradebookAssignmentRow;
  categoryName: string;
  busy: boolean;
  onEditAssignment: (a: GradebookAssignmentRow) => void;
  onDeleteAssignment: (a: GradebookAssignmentRow) => void;
  onOpenScoreEntry: (assignmentId: string) => void;
}) {
  const dueFormatted = formatGradebookDisplayDate(assignment.dueDate);
  const createdFormatted = formatGradebookDisplayDate(assignment.createdAt);
  const termDisplay = assignment.term?.trim() || null;

  return (
    <th
      scope="col"
      className={cn(
        GRADEBOOK_GRID_STICKY.headerRow,
        ASSIGN_COL,
        "px-1 py-1.5 font-medium",
      )}
    >
      {/* Keep position:sticky only on this <th> — see GRADEBOOK_GRID_STICKY pitfall notes. */}
      <div className={cn(GRADEBOOK_GRID_STICKY.headerCellInteractive, "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-1 leading-tight")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "line-clamp-2 flex w-full max-w-full flex-col items-center gap-0.5 rounded-sm pr-6 text-center outline-offset-2",
                "text-[10px] font-medium",
                "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              <span className="line-clamp-2 w-full">{assignment.title}</span>
              <span className="text-muted-foreground text-[9px] font-normal tabular-nums">
                {assignment.pointsPossible} pts
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="center"
            className={cn(
              "border-border bg-popover text-popover-foreground max-w-[min(18rem,calc(100vw-2rem))] border px-3 py-2.5 text-xs shadow-md",
            )}
          >
            <p className="text-foreground font-semibold leading-snug">{assignment.title}</p>
            <dl className="text-muted-foreground mt-2.5 space-y-1.5 text-[11px] leading-snug">
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <dt className="text-foreground font-medium">Category</dt>
                <dd className="min-w-0 text-right">{categoryName}</dd>
                <dt className="text-foreground font-medium">Points</dt>
                <dd className="text-right tabular-nums">{assignment.pointsPossible}</dd>
                <dt className="text-foreground font-medium">Term</dt>
                <dd className="text-right">{termDisplay ?? "—"}</dd>
                {dueFormatted ? (
                  <>
                    <dt className="text-foreground font-medium">Due</dt>
                    <dd className="text-right">{dueFormatted}</dd>
                  </>
                ) : null}
                <dt className="text-foreground font-medium">Created</dt>
                <dd className="text-right">{createdFormatted ?? "—"}</dd>
              </div>
            </dl>
          </TooltipContent>
        </Tooltip>
        <GradebookAssignmentMenu
          assignment={assignment}
          disabled={busy}
          triggerClassName="absolute top-0.5 right-0 z-20 h-6 w-6"
          onEdit={onEditAssignment}
          onDelete={onDeleteAssignment}
          onEnterScores={onOpenScoreEntry}
        />
      </div>
    </th>
  );
}

function GradebookGridTable({
  scrollContainerRef,
  students,
  columns,
  assignmentColIndex,
  scoresByStudentId,
  assignmentsForCalc,
  categoriesForCalc,
  termFilter,
  busy,
  cellSaveState,
  onCellSave,
  onOpenScoreEntry,
  onEditAssignment,
  onDeleteAssignment,
  hasAnyScores,
}: {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  students: GradebookStudentRow[];
  columns: GridColumn[];
  assignmentColIndex: Map<string, number>;
  scoresByStudentId: Map<string, GradebookScoreRow[]>;
  assignmentsForCalc: AssignmentForCalc[];
  categoriesForCalc: CategoryForCalc[];
  termFilter: string;
  busy: boolean;
  cellSaveState: Record<string, "saving" | "saved" | "error">;
  onCellSave: GradebookGridProps["onCellSave"];
  onOpenScoreEntry: (assignmentId: string) => void;
  onEditAssignment: (assignment: GradebookAssignmentRow) => void;
  onDeleteAssignment: (assignment: GradebookAssignmentRow) => void;
  hasAnyScores: boolean;
}) {
  const navigation = useGradebookGridNavigationOptional();

  return (
    <div className="space-y-2">
      {!hasAnyScores ? (
        <p
          className="text-muted-foreground border-border/70 bg-muted/20 rounded-md border border-dashed px-3 py-2 text-xs"
          role="status"
        >
          No scores entered yet. Click a cell to select, double-click or Enter to
          edit, or paste a column from Excel. Use Enter scores in the toolbar for bulk
          entry.
        </p>
      ) : null}

      <TooltipProvider delayDuration={280}>
        <div
          ref={scrollContainerRef}
          className="border-border/80 max-h-[min(62vh,calc(100dvh-18rem))] overflow-auto overscroll-contain rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:max-h-[min(68vh,calc(100dvh-15rem))] lg:max-h-[min(70vh,calc(100dvh-16rem))]"
          role="region"
          aria-label="Gradebook spreadsheet"
          tabIndex={0}
          onKeyDown={navigation?.handleGridKeyDown}
          onPaste={navigation?.handleGridPaste}
        >
          {/*
            TODO(virtualization): For 100+ students or assignments, window rows/columns
            (e.g. @tanstack/react-virtual) — full DOM today is O(rows × cols) nodes.
          */}
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={cn(
                    GRADEBOOK_GRID_STICKY.studentCorner,
                    GRADEBOOK_GRID_STICKY.edgeFrozenColumn,
                    "px-3 py-2 text-left text-xs font-semibold",
                  )}
                >
                  Student
                </th>
                {columns.map((col, i) => {
                  if (col.kind === "assignment") {
                    return (
                      <GradebookAssignmentColumnHeader
                        key={`a-${col.assignment.id}`}
                        assignment={col.assignment}
                        categoryName={col.categoryName}
                        busy={busy}
                        onEditAssignment={onEditAssignment}
                        onDeleteAssignment={onDeleteAssignment}
                        onOpenScoreEntry={onOpenScoreEntry}
                      />
                    );
                  }
                  return (
                    <th
                      key={`c-${col.category.id}-${i}`}
                      scope="col"
                      className={cn(
                        GRADEBOOK_GRID_STICKY.headerCategoryAvg,
                        SCORE_COL,
                        "px-1 py-1.5 text-center text-[10px] font-semibold",
                      )}
                    >
                      <span className="line-clamp-1">{col.category.name}</span>
                      <span className="text-muted-foreground block text-[9px] font-normal">
                        Avg
                      </span>
                    </th>
                  );
                })}
                <th
                  scope="col"
                  className={cn(OVERALL_HEADER, SCORE_COL, "px-1 py-1.5")}
                >
                  Overall
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, rowIndex) => (
                <MemoStudentGridRow
                  key={st.studentId}
                  student={st}
                  rowIndex={rowIndex}
                  columns={columns}
                  assignmentColIndex={assignmentColIndex}
                  studentScores={scoresForStudent(scoresByStudentId, st.studentId)}
                  assignmentsForCalc={assignmentsForCalc}
                  categoriesForCalc={categoriesForCalc}
                  termFilter={termFilter}
                  cellSaveState={cellSaveState}
                  onCellSave={onCellSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      </TooltipProvider>
    </div>
  );
}

export function GradebookGrid({
  scrollContainerRef,
  students,
  categories,
  assignments,
  scores,
  termFilter,
  assignmentsForCalc,
  categoriesForCalc,
  busy,
  cellSaveState,
  onCellSave,
  onOpenScoreEntry,
  onEditAssignment,
  onDeleteAssignment,
  onColumnPaste,
  onPasteRejected,
}: GradebookGridProps) {
  const columns = React.useMemo(
    () => buildColumns(categories, assignments, termFilter),
    [categories, assignments, termFilter],
  );

  const assignmentColIndex = React.useMemo(
    () => buildAssignmentColIndex(columns),
    [columns],
  );

  const editableColumns = React.useMemo(
    () => buildEditableColumns(columns),
    [columns],
  );

  const scoresByStudentId = React.useMemo(
    () => groupScoresByStudentId(scores),
    [scores],
  );

  const assignmentIds = React.useMemo(
    () => assignmentIdsInView(assignments, termFilter),
    [assignments, termFilter],
  );

  const hasAnyScores = React.useMemo(
    () => scores.some((s) => assignmentIds.has(s.assignmentId)),
    [scores, assignmentIds],
  );

  if (students.length === 0 || columns.length === 0) {
    return (
      <GridEmpty
        students={students}
        categories={categories}
        assignments={assignments}
        termFilter={termFilter}
      />
    );
  }

  return (
    <GradebookGridNavigationProvider
      rowCount={students.length}
      editableColumns={editableColumns}
      scrollContainerRef={scrollContainerRef}
      disabled={busy}
      onColumnPaste={onColumnPaste}
      onPasteRejected={onPasteRejected}
    >
      <GradebookGridTable
        scrollContainerRef={scrollContainerRef}
        students={students}
        columns={columns}
        assignmentColIndex={assignmentColIndex}
        scoresByStudentId={scoresByStudentId}
        assignmentsForCalc={assignmentsForCalc}
        categoriesForCalc={categoriesForCalc}
        termFilter={termFilter}
        busy={busy}
        cellSaveState={cellSaveState}
        onCellSave={onCellSave}
        onOpenScoreEntry={onOpenScoreEntry}
        onEditAssignment={onEditAssignment}
        onDeleteAssignment={onDeleteAssignment}
        hasAnyScores={hasAnyScores}
      />
    </GradebookGridNavigationProvider>
  );
}
