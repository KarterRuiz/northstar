"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { cn } from "@/lib/utils";

import {
  createGradebookAssignmentAction,
  createGradebookCategoryAction,
  deleteGradebookAssignmentAction,
  deleteGradebookCategoryAction,
  saveGradebookScoreAction,
  saveGradebookScoresBulkAction,
  updateGradebookAssignmentAction,
  updateGradebookCategoryAction,
} from "./actions";
import { GradebookAssignmentMenu } from "./gradebook-assignment-menu";
import {
  categoryAveragePercent,
  formatOverallGrade,
  formatPercent,
  overallGradeMeta,
  sumCategoryWeights,
} from "./calculations";
import { GradebookGrid } from "./gradebook-grid";
import { GradebookReportReadiness } from "./gradebook-report-readiness";
import { GradebookScoreEntrySheet } from "./gradebook-score-entry-sheet";
import {
  mapGradebookAssignmentsForCalc,
  mapGradebookCategoriesForCalc,
} from "./gradebook-calc-mappers";
import {
  buildScoreDraft,
  buildScoreMap,
  groupScoresByStudentId,
  mergeOneSavedScore,
  mergeSavedScores,
  scoreKey,
  scoresForStudent,
  selectClassName,
  type GradebookTab,
  type ScoreDraftRow,
} from "./gradebook-utils";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
  GradebookReportReadinessByStudent,
  GradebookScoreRow,
  GradebookStudentRow,
} from "./load-gradebook-data";
import { parsePointsEarned, type AssignmentInput, type CategoryInput } from "./schema";

const BASE = "/dashboard/teacher";

type GradebookViewProps = {
  classId: string;
  className: string;
  classSubtitle: string;
  schoolYearLabel: string;
  reportReadinessByStudent: GradebookReportReadinessByStudent;
  categories: GradebookCategoryRow[];
  assignments: GradebookAssignmentRow[];
  scores: GradebookScoreRow[];
  students: GradebookStudentRow[];
};

function emptyCategoryInput(): CategoryInput {
  return { name: "", weightPercent: "0" };
}

function emptyAssignmentInput(categoryId?: string): AssignmentInput {
  return {
    categoryId: categoryId ?? "",
    title: "",
    description: "",
    pointsPossible: "100",
    dueDate: "",
    term: "",
  };
}

function assignmentInputFromRow(assignment: GradebookAssignmentRow): AssignmentInput {
  return {
    categoryId: assignment.categoryId,
    title: assignment.title,
    description: assignment.description ?? "",
    pointsPossible: String(assignment.pointsPossible),
    dueDate: assignment.dueDate ?? "",
    term: (assignment.term ?? "") as AssignmentInput["term"],
  };
}

export function GradebookView({
  classId,
  className: classDisplayName,
  classSubtitle,
  schoolYearLabel,
  reportReadinessByStudent,
  categories: initialCategories,
  assignments: initialAssignments,
  scores: initialScores,
  students,
}: GradebookViewProps) {
  const [activeTab, setActiveTab] = React.useState<GradebookTab>("grid");
  const [localCategories, setLocalCategories] =
    React.useState(initialCategories);
  const [localAssignments, setLocalAssignments] =
    React.useState(initialAssignments);
  const [localScores, setLocalScores] = React.useState(initialScores);

  const [termFilter, setTermFilter] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [isScorePending, startScoreTransition] = React.useTransition();
  const [toast, setToast] = React.useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [assignmentDialogOpen, setAssignmentDialogOpen] = React.useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = React.useState<string | null>(
    null,
  );
  const [originalPointsPossible, setOriginalPointsPossible] = React.useState<
    string | null
  >(null);
  const [deleteConfirmAssignment, setDeleteConfirmAssignment] =
    React.useState<GradebookAssignmentRow | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [scoreSheetOpen, setScoreSheetOpen] = React.useState(false);
  const [scoreSheetAssignmentId, setScoreSheetAssignmentId] = React.useState("");

  const [assignmentForm, setAssignmentForm] = React.useState(() =>
    emptyAssignmentInput(localCategories[0]?.id),
  );
  const [categoryForm, setCategoryForm] = React.useState(emptyCategoryInput);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(
    null,
  );

  const [sheetSaveState, setSheetSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [sheetSaveMessage, setSheetSaveMessage] = React.useState<string | null>(null);
  const gridScrollRef = React.useRef<HTMLDivElement>(null);
  const [cellSaveState, setCellSaveState] = React.useState<
    Record<string, "saving" | "saved" | "error">
  >({});

  const weightTotal = sumCategoryWeights(
    localCategories.map((c) => ({ weightPercent: c.weightPercent })),
  );
  const weightsOk = Math.abs(weightTotal - 100) < 0.01;

  const filteredAssignments = React.useMemo(
    () =>
      termFilter
        ? localAssignments.filter((a) => a.term === termFilter)
        : localAssignments,
    [localAssignments, termFilter],
  );

  const assignmentsForCalc = React.useMemo(
    () => mapGradebookAssignmentsForCalc(localAssignments),
    [localAssignments],
  );

  const categoriesForCalc = React.useMemo(
    () => mapGradebookCategoriesForCalc(localCategories),
    [localCategories],
  );

  const scoresByStudentId = React.useMemo(
    () => groupScoresByStudentId(localScores),
    [localScores],
  );

  const reportsTabRows = React.useMemo(() => {
    const tf = termFilter || null;
    return students.map((st) => {
      const studentScores = scoresForStudent(scoresByStudentId, st.studentId);
      const scoreMap = buildScoreMap(studentScores);
      const categoryPercents: Record<string, number | null> = {};
      for (const cat of localCategories) {
        categoryPercents[cat.id] = categoryAveragePercent({
          assignments: assignmentsForCalc,
          scoresByAssignmentId: scoreMap,
          studentId: st.studentId,
          categoryId: cat.id,
          termFilter: tf,
        });
      }
      const overall = overallGradeMeta({
        categories: categoriesForCalc,
        assignments: assignmentsForCalc,
        scoresByAssignmentId: scoreMap,
        studentId: st.studentId,
        termFilter: tf,
      });
      return {
        studentId: st.studentId,
        displayName: st.displayName,
        categoryPercents,
        overall,
      };
    });
  }, [
    students,
    scoresByStudentId,
    localCategories,
    assignmentsForCalc,
    categoriesForCalc,
    termFilter,
  ]);

  const scoreSheetAssignment =
    localAssignments.find((a) => a.id === scoreSheetAssignmentId) ??
    localAssignments[0] ??
    null;

  const serverScoreDraft = React.useMemo(
    () => buildScoreDraft(scoreSheetAssignment ?? undefined, localScores, students),
    [scoreSheetAssignment, localScores, students],
  );

  const openScoreEntry = React.useCallback((assignmentId: string) => {
    setScoreSheetAssignmentId(assignmentId);
    setSheetSaveState("idle");
    setSheetSaveMessage(null);
    setScoreSheetOpen(true);
  }, []);

  const handleScoreSheetOpenChange = (open: boolean) => {
    setScoreSheetOpen(open);
    if (!open) {
      setSheetSaveState("idle");
      setSheetSaveMessage(null);
    }
  };

  React.useEffect(() => {
    if (sheetSaveState !== "saved") return;
    const timer = window.setTimeout(() => setSheetSaveState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [sheetSaveState]);

  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4000);
  };

  const captureScrollPositions = () => ({
    windowY: typeof window !== "undefined" ? window.scrollY : 0,
    grid:
      gridScrollRef.current == null
        ? null
        : {
            top: gridScrollRef.current.scrollTop,
            left: gridScrollRef.current.scrollLeft,
          },
  });

  const restoreScrollPositions = React.useCallback(
    (pos: ReturnType<typeof captureScrollPositions>) => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: pos.windowY, left: 0 });
        if (pos.grid && gridScrollRef.current) {
          gridScrollRef.current.scrollTop = pos.grid.top;
          gridScrollRef.current.scrollLeft = pos.grid.left;
        }
      });
    },
    [],
  );

  const persistScores = async (
    assignmentId: string,
    draftByStudent: Record<string, ScoreDraftRow>,
    studentIds?: string[],
  ): Promise<boolean> => {
    const targets = studentIds ?? students.map((s) => s.studentId);
    const rows = targets.map((studentId) => {
      const draft = draftByStudent[studentId] ?? {
        pointsEarned: "",
        status: "scored" as const,
        feedback: "",
      };
      return {
        studentId,
        pointsEarned: draft.pointsEarned,
        status: draft.status,
        feedback: draft.feedback,
      };
    });

    const result = await saveGradebookScoresBulkAction({
      classId,
      assignmentId,
      rows,
    });

    if (!result.ok) return false;

    const mergedRows = rows.map((r) => {
      const parsed = parsePointsEarned(r.pointsEarned, r.status);
      return {
        studentId: r.studentId,
        pointsEarned: parsed === "invalid" ? null : parsed,
        status: r.status,
        feedback: r.feedback.trim() || null,
      };
    });

    setLocalScores((prev) => mergeSavedScores(prev, assignmentId, mergedRows));
    return true;
  };

  const handleSheetSave = async (
    draft: Record<string, ScoreDraftRow>,
  ): Promise<boolean> => {
    if (!scoreSheetAssignment) return false;
    const scrollPos = captureScrollPositions();
    setSheetSaveState("saving");
    setSheetSaveMessage(null);
    const ok = await persistScores(scoreSheetAssignment.id, draft);
    startScoreTransition(() => {
      restoreScrollPositions(scrollPos);
      if (!ok) {
        setSheetSaveState("error");
        setSheetSaveMessage("Could not save scores.");
        return;
      }
      showToast("success", "Saved successfully.");
      setActiveTab("grid");
      handleScoreSheetOpenChange(false);
    });
    return ok;
  };

  const handleColumnPaste = async (
    assignmentId: string,
    startRowIndex: number,
    drafts: ScoreDraftRow[],
  ) => {
    const draftByStudent: Record<string, ScoreDraftRow> = {};
    const studentIds: string[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const student = students[startRowIndex + i];
      if (!student) break;
      studentIds.push(student.studentId);
      draftByStudent[student.studentId] = drafts[i];
    }
    if (studentIds.length === 0) return;

    const scrollPos = captureScrollPositions();
    const savingKeys = Object.fromEntries(
      studentIds.map((id) => [scoreKey(assignmentId, id), "saving" as const]),
    );
    setCellSaveState((s) => ({ ...s, ...savingKeys }));

    const ok = await persistScores(assignmentId, draftByStudent, studentIds);

    startScoreTransition(() => {
      restoreScrollPositions(scrollPos);
      if (!ok) {
        setCellSaveState((s) => {
          const next = { ...s };
          for (const id of studentIds) delete next[scoreKey(assignmentId, id)];
          for (const id of studentIds) next[scoreKey(assignmentId, id)] = "error";
          return next;
        });
        showToast("error", "Could not paste scores.");
        return;
      }
      setCellSaveState((s) => {
        const next = { ...s };
        for (const id of studentIds) next[scoreKey(assignmentId, id)] = "saved";
        return next;
      });
      window.setTimeout(() => {
        setCellSaveState((s) => {
          const next = { ...s };
          for (const id of studentIds) delete next[scoreKey(assignmentId, id)];
          return next;
        });
      }, 1500);
    });
  };

  const handleCellSave = React.useCallback(async (
    assignmentId: string,
    studentId: string,
    draft: ScoreDraftRow,
  ) => {
    const key = scoreKey(assignmentId, studentId);
    const scrollPos = captureScrollPositions();
    setCellSaveState((s) => ({ ...s, [key]: "saving" }));

    const result = await saveGradebookScoreAction({
      classId,
      assignmentId,
      row: {
        studentId,
        pointsEarned: draft.pointsEarned,
        status: draft.status,
        feedback: draft.feedback,
      },
    });

    const parsed = parsePointsEarned(draft.pointsEarned, draft.status);
    const ok = result.ok && parsed !== "invalid";

    if (ok) {
      setLocalScores((prev) =>
        mergeOneSavedScore(prev, assignmentId, {
          studentId,
          pointsEarned: parsed,
          status: draft.status,
          feedback: draft.feedback.trim() || null,
        }),
      );
    }

    startScoreTransition(() => {
      restoreScrollPositions(scrollPos);
      if (!ok) {
        setCellSaveState((s) => ({ ...s, [key]: "error" }));
        return;
      }
      setCellSaveState((s) => ({ ...s, [key]: "saved" }));
      window.setTimeout(() => {
        setCellSaveState((s) => {
          const next = { ...s };
          delete next[key];
          return next;
        });
      }, 1500);
    });
  }, [classId, restoreScrollPositions]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = editingCategoryId
      ? await updateGradebookCategoryAction({
          classId,
          categoryId: editingCategoryId,
          input: categoryForm,
        })
      : await createGradebookCategoryAction({ classId, input: categoryForm });
    setBusy(false);
    if (!result.ok) {
      showToast("error", result.message);
      return;
    }
    if (editingCategoryId) {
      setLocalCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategoryId
            ? {
                ...c,
                name: categoryForm.name.trim(),
                weightPercent: Number(categoryForm.weightPercent),
              }
            : c,
        ),
      );
    } else if (result.id) {
      const maxSort = localCategories.reduce(
        (m, c) => Math.max(m, c.sortOrder),
        -1,
      );
      setLocalCategories((prev) => [
        ...prev,
        {
          id: result.id!,
          name: categoryForm.name.trim(),
          weightPercent: Number(categoryForm.weightPercent),
          sortOrder: maxSort + 1,
        },
      ]);
    }
    setCategoryForm(emptyCategoryInput());
    setEditingCategoryId(null);
    setCategoryDialogOpen(false);
    showToast("success", editingCategoryId ? "Category updated." : "Category added.");
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setBusy(true);
    const result = await deleteGradebookCategoryAction({ classId, categoryId });
    setBusy(false);
    if (!result.ok) {
      showToast("error", result.message);
      return;
    }
    setLocalCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setLocalAssignments((prev) => prev.filter((a) => a.categoryId !== categoryId));
    showToast("success", "Category deleted.");
  };

  const openNewAssignmentDialog = () => {
    setEditingAssignmentId(null);
    setOriginalPointsPossible(null);
    setAssignmentForm(emptyAssignmentInput(localCategories[0]?.id));
    setAssignmentDialogOpen(true);
  };

  const openEditAssignmentDialog = (assignment: GradebookAssignmentRow) => {
    setEditingAssignmentId(assignment.id);
    setOriginalPointsPossible(String(assignment.pointsPossible));
    setAssignmentForm(assignmentInputFromRow(assignment));
    setAssignmentDialogOpen(true);
  };

  const handleAssignmentDialogOpenChange = (open: boolean) => {
    setAssignmentDialogOpen(open);
    if (!open) {
      setEditingAssignmentId(null);
      setOriginalPointsPossible(null);
    }
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = editingAssignmentId !== null;
    setBusy(true);
    const result = editingAssignmentId
      ? await updateGradebookAssignmentAction({
          classId,
          assignmentId: editingAssignmentId,
          input: assignmentForm,
        })
      : await createGradebookAssignmentAction({
          classId,
          input: assignmentForm,
        });
    setBusy(false);
    if (!result.ok) {
      showToast("error", result.message);
      return;
    }
    const nextRow = {
      categoryId: assignmentForm.categoryId,
      title: assignmentForm.title.trim(),
      description: assignmentForm.description.trim() || null,
      pointsPossible: Number(assignmentForm.pointsPossible),
      dueDate: assignmentForm.dueDate.trim() || null,
      term: assignmentForm.term || null,
    };
    if (editingAssignmentId) {
      setLocalAssignments((prev) =>
        prev.map((a) =>
          a.id === editingAssignmentId ? { ...a, ...nextRow } : a,
        ),
      );
    } else if (result.id) {
      setLocalAssignments((prev) => [
        ...prev,
        { id: result.id!, ...nextRow, createdAt: new Date().toISOString() },
      ]);
    }
    setAssignmentForm(emptyAssignmentInput(localCategories[0]?.id));
    setEditingAssignmentId(null);
    setOriginalPointsPossible(null);
    setAssignmentDialogOpen(false);
    showToast("success", isEdit ? "Assignment updated." : "Assignment created.");
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    setBusy(true);
    const result = await deleteGradebookAssignmentAction({ classId, assignmentId });
    setBusy(false);
    if (!result.ok) {
      showToast("error", result.message);
      return;
    }
    setLocalAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    setLocalScores((prev) => prev.filter((s) => s.assignmentId !== assignmentId));
    setDeleteConfirmAssignment(null);
    showToast("success", "Assignment deleted.");
  };

  const handleDuplicateAssignment = (assignment: GradebookAssignmentRow) => {
    setEditingAssignmentId(null);
    setOriginalPointsPossible(null);
    setAssignmentForm({
      categoryId: assignment.categoryId,
      title: `${assignment.title} (copy)`,
      description: assignment.description ?? "",
      pointsPossible: String(assignment.pointsPossible),
      dueDate: "",
      term: (assignment.term ?? "") as AssignmentInput["term"],
    });
    setAssignmentDialogOpen(true);
  };

  const pointsPossibleChanged =
    editingAssignmentId !== null &&
    originalPointsPossible !== null &&
    assignmentForm.pointsPossible !== originalPointsPossible;

  const handleEditCategory = (cat: GradebookCategoryRow) => {
    setEditingCategoryId(cat.id);
    setCategoryForm({
      name: cat.name,
      weightPercent: String(cat.weightPercent),
    });
    setCategoryDialogOpen(true);
  };

  return (
    <div className="space-y-0">
      <header className="bg-background/95 sticky top-0 z-40 -mx-4 border-b px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Gradebook
            </p>
            <h1 className="truncate text-lg font-semibold">{classDisplayName}</h1>
            <p className="text-muted-foreground text-xs">{classSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
              <Link href={`${BASE}/classes/${classId}`}>Class roster</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
              <Link href={`${BASE}/gradebook`}>All gradebooks</Link>
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Label htmlFor="gb-term-filter" className="text-muted-foreground sr-only">
              Term
            </Label>
            <select
              id="gb-term-filter"
              className={cn(selectClassName, "h-8 w-auto min-w-[7rem]")}
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
            >
              <option value="">All terms</option>
              {REPORT_CARD_TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {weightsOk ? (
            <Badge variant="secondary" className="text-[10px]">
              Weights 100%
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/50 text-[10px] text-amber-900 dark:text-amber-100"
            >
              <AlertTriangle className="size-3" aria-hidden />
              Weights {weightTotal.toFixed(0)}%
            </Badge>
          )}
          <span className="text-muted-foreground">
            {filteredAssignments.length} assignment
            {filteredAssignments.length === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">
            {students.length} student{students.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={busy || localCategories.length === 0}
            onClick={openNewAssignmentDialog}
          >
            <Plus className="mr-1 size-3.5" aria-hidden />
            New assignment
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={busy}
            onClick={() => {
              setCategoryForm(emptyCategoryInput());
              setEditingCategoryId(null);
              setCategoryDialogOpen(true);
            }}
          >
            Manage categories
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={busy || localAssignments.length === 0}
            onClick={() => {
              const id = scoreSheetAssignmentId || localAssignments[0]?.id;
              if (id) openScoreEntry(id);
            }}
          >
            Enter scores
          </Button>
        </div>
      </header>

      {toast ? (
        <div
          className={cn(
            "mt-4 rounded-lg border px-4 py-2 text-sm",
            toast.kind === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border-destructive/50 bg-destructive/10 text-destructive",
          )}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as GradebookTab)}
        className="mt-4"
      >
        <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 lg:mx-0 lg:overflow-visible lg:px-0">
          <TabsList className="h-auto min-h-9 w-max min-w-full justify-start gap-0.5 p-1 lg:w-auto lg:flex-wrap">
            <TabsTrigger value="grid" className="shrink-0 px-3 text-xs">
              Gradebook Grid
            </TabsTrigger>
            <TabsTrigger value="assignments" className="shrink-0 px-3 text-xs">
              Assignments
            </TabsTrigger>
            <TabsTrigger value="categories" className="shrink-0 px-3 text-xs">
              Categories / Weights
            </TabsTrigger>
            <TabsTrigger value="reports" className="shrink-0 px-3 text-xs">
              Reports / Summary
            </TabsTrigger>
            <TabsTrigger value="readiness" className="shrink-0 px-3 text-xs">
              Report readiness
            </TabsTrigger>
          </TabsList>
        </div>

        {/* forceMount: keep grid mounted across tab switches so scroll + editors survive saves */}
        <TabsContent value="grid" className="mt-3" forceMount>
          <GradebookGrid
            scrollContainerRef={gridScrollRef}
            students={students}
            categories={localCategories}
            assignments={localAssignments}
            scores={localScores}
            termFilter={termFilter}
            assignmentsForCalc={assignmentsForCalc}
            categoriesForCalc={categoriesForCalc}
            busy={busy}
            cellSaveState={cellSaveState}
            onCellSave={handleCellSave}
            onColumnPaste={handleColumnPaste}
            onPasteRejected={(message) => showToast("error", message)}
            onOpenScoreEntry={openScoreEntry}
            onEditAssignment={openEditAssignmentDialog}
            onDeleteAssignment={setDeleteConfirmAssignment}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-3">
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={busy || localCategories.length === 0}
              onClick={openNewAssignmentDialog}
            >
              <Plus className="mr-1 size-3.5" aria-hidden />
              New assignment
            </Button>
          </div>
          {filteredAssignments.length > 0 ? (
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((a) => {
                  const cat = localCategories.find((c) => c.id === a.categoryId);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{cat?.name ?? "—"}</TableCell>
                      <TableCell>{a.pointsPossible}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {a.dueDate ?? "—"}
                      </TableCell>
                      <TableCell>{a.term ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => openEditAssignmentDialog(a)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleDuplicateAssignment(a)}
                          >
                            Duplicate
                          </Button>
                          <GradebookAssignmentMenu
                            assignment={a}
                            disabled={busy}
                            showEditItem={false}
                            onEdit={openEditAssignmentDialog}
                            onDelete={setDeleteConfirmAssignment}
                            onEnterScores={openScoreEntry}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No assignments yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-3 space-y-4">
          {!weightsOk ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Category weights total <strong>{weightTotal.toFixed(1)}%</strong> (not
                100%). Overall grades use the weights as entered.
              </span>
            </div>
          ) : null}
          {localCategories.length > 0 ? (
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border">
            <Table className="min-w-[24rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...localCategories]
                  .sort(
                    (a, b) =>
                      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
                  )
                  .map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>{cat.weightPercent}%</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleEditCategory(cat)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No categories yet.</p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              setCategoryForm(emptyCategoryInput());
              setEditingCategoryId(null);
              setCategoryDialogOpen(true);
            }}
          >
            Add category
          </Button>
        </TabsContent>

        <TabsContent value="reports" className="mt-3">
          {students.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No students to report on.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[min(60vh,calc(100dvh-14rem))] overflow-auto overscroll-contain">
                <div className="overflow-x-auto overscroll-x-contain">
                <Table className="min-w-[32rem]">
                  <TableHeader className="bg-muted/80 sticky top-0">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      {localCategories.map((cat) => (
                        <TableHead key={cat.id}>{cat.name}</TableHead>
                      ))}
                      <TableHead>Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsTabRows.map((row) => (
                        <TableRow key={row.studentId}>
                          <TableCell className="font-medium">{row.displayName}</TableCell>
                          {localCategories.map((cat) => {
                            const catAvg = row.categoryPercents[cat.id] ?? null;
                            return (
                              <TableCell key={cat.id} className="tabular-nums">
                                {formatPercent(catAvg)}
                              </TableCell>
                            );
                          })}
                          <TableCell className="font-medium tabular-nums">
                            {formatOverallGrade(row.overall)}
                            {row.overall.isPartial ? (
                              <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                                Running grade
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          )}
          {termFilter ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Filtered to term {termFilter}. Running grades use only categories with entered
              scores, with weights renormalized across those categories.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="readiness" className="mt-3">
          <GradebookReportReadiness
            students={students}
            categories={localCategories}
            assignments={localAssignments}
            scores={localScores}
            assignmentsForCalc={assignmentsForCalc}
            categoriesForCalc={categoriesForCalc}
            termFilter={termFilter}
            schoolYearLabel={schoolYearLabel}
            reportReadinessByStudent={reportReadinessByStudent}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={assignmentDialogOpen}
        onOpenChange={handleAssignmentDialogOpenChange}
      >
        <DialogContent className="max-h-[90dvh] w-[min(100%,28rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? "Edit assignment" : "New assignment"}
            </DialogTitle>
            <DialogDescription>
              {editingAssignmentId
                ? "Update title, category, points, term, due date, or description."
                : "Link a graded item to a category. Sort order is automatic."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAssignment} className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="assign-title">Title</Label>
              <Input
                id="assign-title"
                value={assignmentForm.title}
                onChange={(e) =>
                  setAssignmentForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="assign-cat">Category</Label>
                <select
                  id="assign-cat"
                  className={selectClassName}
                  value={assignmentForm.categoryId}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, categoryId: e.target.value }))
                  }
                  required
                >
                  <option value="">Select…</option>
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-points">Points possible</Label>
                <Input
                  id="assign-points"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={assignmentForm.pointsPossible}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, pointsPossible: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-term">Term</Label>
                <select
                  id="assign-term"
                  className={selectClassName}
                  value={assignmentForm.term}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({
                      ...p,
                      term: e.target.value as AssignmentInput["term"],
                    }))
                  }
                >
                  <option value="">None</option>
                  {REPORT_CARD_TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assign-due">Due date</Label>
                <Input
                  id="assign-due"
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) =>
                    setAssignmentForm((p) => ({ ...p, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            {pointsPossibleChanged ? (
              <div
                className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Changing points possible will recalculate percentages for existing
                  scores.
                </span>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="assign-desc">Description</Label>
              <Input
                id="assign-desc"
                value={assignmentForm.description}
                onChange={(e) =>
                  setAssignmentForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" size="sm" disabled={busy}>
                {editingAssignmentId ? "Save changes" : "Create assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteConfirmAssignment !== null}
        onOpenChange={(open) => !open && setDeleteConfirmAssignment(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this assignment?</DialogTitle>
            <DialogDescription>
              This will also remove all scores entered for this assignment.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirmAssignment ? (
            <p className="text-muted-foreground text-sm font-medium">
              {deleteConfirmAssignment.title}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setDeleteConfirmAssignment(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !deleteConfirmAssignment}
              onClick={() => {
                if (deleteConfirmAssignment) {
                  void handleDeleteAssignment(deleteConfirmAssignment.id);
                }
              }}
            >
              Delete assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[min(100%,24rem)] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategoryId ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              Set name and weight. Display order is assigned automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-weight">Weight %</Label>
              <Input
                id="cat-weight"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={categoryForm.weightPercent}
                onChange={(e) =>
                  setCategoryForm((p) => ({ ...p, weightPercent: e.target.value }))
                }
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {editingCategoryId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCategoryForm(emptyCategoryInput());
                  }}
                >
                  Cancel edit
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={busy}>
                {editingCategoryId ? "Update" : "Add category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <GradebookScoreEntrySheet
        open={scoreSheetOpen}
        onOpenChange={handleScoreSheetOpenChange}
        assignment={scoreSheetAssignment}
        students={students}
        serverScoreDraft={serverScoreDraft}
        savePending={isScorePending || sheetSaveState === "saving"}
        saveState={sheetSaveState}
        saveMessage={sheetSaveMessage}
        onSave={handleSheetSave}
      />
    </div>
  );
}

