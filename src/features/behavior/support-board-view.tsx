"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { siteConfig } from "@/config/site";
import {
  monthRangeContaining,
  todayIso,
  weekRangeContaining,
} from "@/features/attendance/attendance-date-utils";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import type { MinimalMoment } from "@/lib/student-support/support-recommendations";
import { cn } from "@/lib/utils";

import { createBehaviorRecordAction } from "./actions";
import {
  memoryTypeBucket,
  type ClassroomMemoryTimeFilter,
  type ClassroomMemoryTypeFilter,
} from "./classroom-memory-feed";
import type { BehaviorLogRow } from "./load-behavior-page-data";
import type { BehaviorStudentOption } from "./schema";
import type { SupportBoardAction } from "./support-board-chips";
import {
  emptySupportBoardStudentSnapshot,
  type SupportBoardStudentSnapshot,
} from "./support-board-snapshot-types";
import {
  prepareQuickSupportMoment,
  type PersistQuickSupportInput,
} from "./support-board-persist";
import { deriveSupportBoardInsights } from "./support-board-insights";
import type { StudentSupportInsight } from "./support-board-insights";
import { SupportBoardClassroomSnapshotPanel } from "./support-board-classroom-snapshot-panel";
import { SupportBoardQuickActionOverlay } from "./support-board-quick-action-overlay";
import { SupportBoardStudentCard } from "./support-board-student-card";
import { SupportBoardTimelineLazy } from "./support-board-timeline-lazy";

type QuickSavePayload = Pick<PersistQuickSupportInput, "action" | "quickReasonKey" | "teacherNote">;
const BASE = "/dashboard/teacher/behavior";

function behaviorRowToMinimalMoment(row: BehaviorLogRow): MinimalMoment {
  return {
    behavior_type: row.behaviorType,
    support_category: row.supportCategory,
    quick_reason: row.quickReason,
    behavior_date: row.behaviorDate,
    flags: {
      follow_up_required: row.followUpRequired,
      parent_contacted: row.parentContacted === true,
    },
  };
}

type OpenQuickKey = { studentId: string; action: SupportBoardAction };

function emptyQuickNotes(): Record<SupportBoardAction, string> {
  return { positive: "", concern: "", strategy: "", parent: "" };
}

type SupportBoardViewProps = {
  classes: { id: string; label: string }[];
  classId: string;
  rows: BehaviorLogRow[];
  students: BehaviorStudentOption[];
  viewerDisplayName: string | null;
  urlStudentId: string | null;
  supportBoardByStudentId?: Record<string, SupportBoardStudentSnapshot>;
};

export function SupportBoardView({
  classes,
  classId,
  rows,
  students,
  viewerDisplayName,
  urlStudentId,
  supportBoardByStudentId,
}: SupportBoardViewProps) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [localRows, setLocalRows] = React.useState<BehaviorLogRow[]>([]);
  const [search, setSearch] = React.useState("");
  const [memoryStudentSearch, setMemoryStudentSearch] = React.useState("");
  const [memoryType, setMemoryType] = React.useState<ClassroomMemoryTypeFilter>("all");
  const [memoryTime, setMemoryTime] = React.useState<ClassroomMemoryTimeFilter>("all");
  const [openQuickKey, setOpenQuickKey] = React.useState<OpenQuickKey | null>(null);
  const [quickNotesByStudent, setQuickNotesByStudent] = React.useState<
    Record<string, Record<SupportBoardAction, string>>
  >({});
  const [quickSaving, setQuickSaving] = React.useState(false);
  const openQuickAnchorRef = React.useRef<HTMLButtonElement | null>(null);

  const mergedRows = React.useMemo(() => {
    const seen = new Set<string>();
    const out: BehaviorLogRow[] = [];
    for (const r of [...localRows, ...rows]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [localRows, rows]);

  const studentSupportMomentsById = React.useMemo(() => {
    const map = new Map<string, MinimalMoment[]>();
    for (const r of mergedRows) {
      if (r.classId !== classId) continue;
      const m = behaviorRowToMinimalMoment(r);
      const list = map.get(r.studentId);
      if (list) list.push(m);
      else map.set(r.studentId, [m]);
    }
    for (const [id, list] of map) {
      list.sort((a, b) => b.behavior_date.localeCompare(a.behavior_date));
      map.set(id, list);
    }
    return map;
  }, [mergedRows, classId]);

  const memoryFilteredRows = React.useMemo(() => {
    const q = memoryStudentSearch.trim().toLowerCase();
    const anchor = todayIso();
    const week = weekRangeContaining(anchor);
    const month = monthRangeContaining(anchor);

    return mergedRows.filter((row) => {
      if (q && !row.displayName.toLowerCase().includes(q)) return false;
      if (memoryType !== "all" && memoryTypeBucket(row) !== memoryType) return false;
      const d = row.behaviorDate.slice(0, 10);
      if (memoryTime === "week" && (d < week.start || d > week.end)) return false;
      if (memoryTime === "month" && (d < month.start || d > month.end)) return false;
      return true;
    });
  }, [mergedRows, memoryStudentSearch, memoryType, memoryTime]);

  const classLabel = React.useMemo(
    () => classes.find((c) => c.id === classId)?.label ?? "Class",
    [classes, classId],
  );

  const roster = React.useMemo(() => {
    let list = students;
    if (urlStudentId && list.some((s) => s.id === urlStudentId)) {
      list = list.filter((s) => s.id === urlStudentId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => s.label.toLowerCase().includes(q));
    }
    return list;
  }, [students, urlStudentId, search]);

  const supportInsightBundle = React.useMemo(() => {
    return deriveSupportBoardInsights(
      mergedRows,
      classId,
      students.map((s) => s.id),
      new Date(),
    );
  }, [mergedRows, classId, students]);

  const studentInsightById = supportInsightBundle.studentById;

  const defaultStudentInsight = React.useMemo((): StudentSupportInsight => {
    return {
      trendDirection: "stable",
      trendAriaLabel: "Recent trend: stable",
      momentumLine: "Stable week",
      ratioLine: null,
      positivePercentThisWeek: null,
      patterns: [],
    };
  }, []);

  const closeQuickOverlay = React.useCallback(() => {
    const el = openQuickAnchorRef.current;
    setOpenQuickKey(null);
    openQuickAnchorRef.current = null;
    requestAnimationFrame(() => {
      if (el instanceof HTMLElement && document.body.contains(el)) {
        el.focus({ preventScroll: true });
      }
    });
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      setOpenQuickKey(null);
      openQuickAnchorRef.current = null;
    });
  }, [classId]);

  function pushUrl(next: { classId?: string; studentId?: string | null }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? classId);
    const sid = "studentId" in next ? next.studentId : urlStudentId;
    if (sid) params.set("studentId", sid);
    router.push(`${BASE}?${params.toString()}`);
  }

  const handleQuickSave = React.useCallback(
    async (student: BehaviorStudentOption, payload: QuickSavePayload) => {
      const prep = prepareQuickSupportMoment({
        student,
        classId,
        classLabel,
        action: payload.action,
        quickReasonKey: payload.quickReasonKey,
        teacherNote: payload.teacherNote,
        viewerDisplayName,
      });
      if (!prep.ok) {
        showToast("error", prep.message);
        return false;
      }

      const tempId = `pending:${crypto.randomUUID()}`;
      const optimisticRow = prep.toRow(tempId);
      setLocalRows((prev) => [optimisticRow, ...prev]);
      showToast("success", `Saved to ${student.label}.`);

      const result = await createBehaviorRecordAction(prep.insert);
      if (!result.ok) {
        setLocalRows((prev) => prev.filter((r) => r.id !== tempId));
        showToast("error", result.message);
        return false;
      }

      setLocalRows((prev) =>
        prev.map((r) => (r.id === tempId ? prep.toRow(result.recordId) : r)),
      );
      setQuickNotesByStudent((q) => ({
        ...q,
        [student.id]: {
          ...(q[student.id] ?? emptyQuickNotes()),
          [payload.action]: "",
        },
      }));
      closeQuickOverlay();
      return true;
    },
    [classId, classLabel, viewerDisplayName, showToast, closeQuickOverlay],
  );

  const overlayStudent = React.useMemo(() => {
    if (!openQuickKey) return null;
    return students.find((s) => s.id === openQuickKey.studentId) ?? null;
  }, [openQuickKey, students]);

  const overlayNote =
    openQuickKey && overlayStudent
      ? (quickNotesByStudent[openQuickKey.studentId]?.[openQuickKey.action] ?? "")
      : "";

  const handleOverlayNoteChange = React.useCallback(
    (v: string) => {
      if (!openQuickKey) return;
      const { studentId, action } = openQuickKey;
      setQuickNotesByStudent((q) => ({
        ...q,
        [studentId]: { ...(q[studentId] ?? emptyQuickNotes()), [action]: v },
      }));
    },
    [openQuickKey],
  );

  const handleQuickActionPress = React.useCallback(
    (studentId: string, action: SupportBoardAction, anchorEl: HTMLButtonElement) => {
      let opening = false;
      setOpenQuickKey((prev) => {
        const closing = prev?.studentId === studentId && prev?.action === action;
        if (closing) {
          openQuickAnchorRef.current = null;
          window.requestAnimationFrame(() => {
            if (document.body.contains(anchorEl)) {
              anchorEl.focus({ preventScroll: true });
            }
          });
          return null;
        }
        openQuickAnchorRef.current = anchorEl;
        opening = true;
        return { studentId, action };
      });
      if (opening) {
        setQuickNotesByStudent((q) => ({
          ...q,
          [studentId]: {
            ...(q[studentId] ?? emptyQuickNotes()),
            [action]: "",
          },
        }));
      }
    },
    [],
  );

  const handleOverlayChip = React.useCallback(
    async (quickReasonKey: string) => {
      if (!openQuickKey || !overlayStudent) return;
      const teacherNote =
        quickNotesByStudent[openQuickKey.studentId]?.[openQuickKey.action] ?? "";
      setQuickSaving(true);
      try {
        await handleQuickSave(overlayStudent, {
          action: openQuickKey.action,
          quickReasonKey,
          teacherNote,
        });
      } finally {
        setQuickSaving(false);
      }
    },
    [openQuickKey, overlayStudent, quickNotesByStudent, handleQuickSave],
  );

  return (
    <TooltipProvider delayDuration={0}>
    <div className="from-slate-50/90 via-sky-50/20 to-amber-50/15 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 min-h-screen min-w-0 overflow-x-clip bg-gradient-to-b pb-28 md:pb-16">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-8 p-4 sm:p-6 lg:p-8">
        <header className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
            {siteConfig.shortName}
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                Student support board
              </h1>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                Tap a chip — strengths, check-ins, and strategies land on Classroom Memory below in
                seconds.
              </p>
            </div>
          </div>
        </header>

        <section className="border-border/60 bg-card/92 flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="grid w-full gap-4 sm:max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="support-class">Class</Label>
              <select
                id="support-class"
                className={selectClassName}
                value={classId}
                onChange={(e) => {
                  const next = e.target.value;
                  pushUrl({ classId: next, studentId: null });
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-search">Search roster</Label>
              <Input
                id="support-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name…"
                autoComplete="off"
              />
            </div>
          </div>
          {urlStudentId ? (
            <button
              type="button"
              onClick={() => pushUrl({ studentId: null })}
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Show full class
            </button>
          ) : null}
        </section>

        <SupportBoardClassroomSnapshotPanel
          classroomSnapshot={supportInsightBundle.classroomSnapshot}
          classInsight={supportInsightBundle.classSummary}
        />

        {roster.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {students.length === 0
              ? "No roster for this class yet."
              : "No students match this search."}
          </p>
        ) : (
          <section
            aria-label="Class roster"
            className="grid min-w-0 grid-cols-1 gap-3 px-0.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {roster.map((student) => {
              const snapshot =
                supportBoardByStudentId?.[student.id] ?? emptySupportBoardStudentSnapshot();
              return (
                <SupportBoardStudentCard
                  key={student.id}
                  student={student}
                  classId={classId}
                  classLabel={classLabel}
                  snapshot={snapshot}
                  studentInsight={studentInsightById.get(student.id) ?? defaultStudentInsight}
                  timelineRows={mergedRows}
                  supportMoments={studentSupportMomentsById.get(student.id) ?? []}
                  openTrayAction={
                    openQuickKey?.studentId === student.id ? openQuickKey.action : null
                  }
                  onQuickActionPress={(action, anchorEl) =>
                    handleQuickActionPress(student.id, action, anchorEl)
                  }
                  quickActionsDisabled={quickSaving}
                />
              );
            })}
          </section>
        )}

        <section aria-label="Classroom memory" className="space-y-4">
          <div className="px-0.5">
            <h2 className="text-lg font-semibold tracking-tight">Classroom Memory</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A lightweight feed of recent support moments for this class — scan strengths, concerns, and
              follow-ups at a glance.
            </p>
          </div>

          <div className="border-border/55 bg-card/70 flex flex-col gap-3 rounded-xl border p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-4">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label htmlFor="memory-student-search">Search students</Label>
              <Input
                id="memory-student-search"
                value={memoryStudentSearch}
                onChange={(e) => setMemoryStudentSearch(e.target.value)}
                placeholder="Filter by student name…"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-foreground text-sm font-medium" id="memory-type-label">
                Type
              </span>
              <div
                role="group"
                aria-labelledby="memory-type-label"
                className="flex flex-wrap gap-1"
              >
                {(
                  [
                    ["all", "All"],
                    ["positive", "Positive"],
                    ["concern", "Concern"],
                    ["strategy", "Strategy"],
                    ["parent", "Parent"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={memoryType === value ? "secondary" : "outline"}
                    className={cn(
                      "h-8 rounded-lg px-2.5 text-xs font-medium",
                      "transform-gpu transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out",
                      "motion-reduce:transition-colors",
                      "active:scale-[0.98] motion-reduce:active:scale-100",
                      memoryType === value && "ring-ring/30 ring-2",
                    )}
                    aria-pressed={memoryType === value}
                    onClick={() => setMemoryType(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-foreground text-sm font-medium" id="memory-time-label">
                Time
              </span>
              <div
                role="group"
                aria-labelledby="memory-time-label"
                className="flex flex-wrap gap-1"
              >
                {(
                  [
                    ["week", "This week"],
                    ["month", "This month"],
                    ["all", "All"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={memoryTime === value ? "secondary" : "outline"}
                    className={cn(
                      "h-8 rounded-lg px-2.5 text-xs font-medium",
                      "transform-gpu transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out",
                      "motion-reduce:transition-colors",
                      "active:scale-[0.98] motion-reduce:active:scale-100",
                      memoryTime === value && "ring-ring/30 ring-2",
                    )}
                    aria-pressed={memoryTime === value}
                    onClick={() => setMemoryTime(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {mergedRows.length >= 50 ? (
            <p className="text-muted-foreground px-0.5 text-xs leading-relaxed">
              Up to 50 recent moments are loaded for this class; filters apply to this list only.
            </p>
          ) : null}

          <div className="border-border/50 bg-card/60 rounded-2xl border p-4 shadow-sm sm:p-6">
            <SupportBoardTimelineLazy
              rows={memoryFilteredRows}
              sourceRowCount={mergedRows.length}
            />
          </div>
        </section>
      </div>

      <WorkspaceToast toast={toast} />

      <SupportBoardQuickActionOverlay
        open={Boolean(openQuickKey)}
        anchorRef={openQuickAnchorRef}
        classId={classId}
        student={overlayStudent}
        action={openQuickKey?.action ?? null}
        note={overlayNote}
        onNoteChange={handleOverlayNoteChange}
        disabled={quickSaving}
        onChip={(key) => void handleOverlayChip(key)}
        onDismiss={closeQuickOverlay}
      />
    </div>
    </TooltipProvider>
  );
}
