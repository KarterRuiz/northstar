import { Suspense } from "react";

import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import { AttendanceConcernsPanel } from "./attendance-concerns-panel";
import { parseAttendanceTab } from "./attendance-utils";
import { AttendanceWorkspaceShell } from "./attendance-workspace-shell";
import { AttendanceView } from "./attendance-view";
import { loadAttendanceConcernsData } from "./load-attendance-concerns-data";
import { loadAttendancePageData } from "./load-attendance-page-data";
import { loadMonthlyReviewData } from "./load-monthly-review-data";
import { loadWeeklyReviewData } from "./load-weekly-review-data";
import { MonthlyReviewPanel } from "./monthly-review-panel";
import { WeeklyReviewPanel } from "./weekly-review-panel";

type AttendanceWorkspacePageContentProps = {
  classId: string | null;
  attendanceDate: string | null;
  tab: string | null;
  week: string | null;
  month: string | null;
};

async function DailyTab({
  classId,
  attendanceDate,
}: Pick<AttendanceWorkspacePageContentProps, "classId" | "attendanceDate">) {
  const data = await loadAttendancePageData({ classId, attendanceDate });
  if (!data.ok) {
    return <ErrorBanner message={data.message} />;
  }
  return (
    <AttendanceView
      embedded
      classes={data.classes}
      classId={data.classId}
      schoolYearLabel={data.schoolYearLabel}
      attendanceDate={data.attendanceDate}
      roster={data.roster}
      stats={data.stats}
    />
  );
}

async function WeeklyTab({
  classId,
  week,
}: Pick<AttendanceWorkspacePageContentProps, "classId" | "week">) {
  const data = await loadWeeklyReviewData({ classId, weekStart: week });
  if (!data.ok) return <ErrorBanner message={data.message} />;
  return <WeeklyReviewPanel {...data} />;
}

async function MonthlyTab({
  classId,
  month,
}: Pick<AttendanceWorkspacePageContentProps, "classId" | "month">) {
  const data = await loadMonthlyReviewData({ classId, month });
  if (!data.ok) return <ErrorBanner message={data.message} />;
  return <MonthlyReviewPanel {...data} />;
}

async function ConcernsTab() {
  const data = await loadAttendanceConcernsData();
  if (!data.ok) return <ErrorBanner message={data.message} />;
  return <AttendanceConcernsPanel rows={data.rows} />;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
      role="alert"
    >
      <span className="font-medium">Could not load attendance.</span> {message}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

function TabFallback() {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading tab">
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

async function AttendanceWorkspaceInner(props: AttendanceWorkspacePageContentProps) {
  const tab = parseAttendanceTab(props.tab);

  const activePanel =
    tab === "daily" ? (
      <Suspense fallback={<TabFallback />}>
        <DailyTab classId={props.classId} attendanceDate={props.attendanceDate} />
      </Suspense>
    ) : tab === "weekly" ? (
      <Suspense fallback={<TabFallback />}>
        <WeeklyTab classId={props.classId} week={props.week} />
      </Suspense>
    ) : tab === "monthly" ? (
      <Suspense fallback={<TabFallback />}>
        <MonthlyTab classId={props.classId} month={props.month} />
      </Suspense>
    ) : (
      <Suspense fallback={<TabFallback />}>
        <ConcernsTab />
      </Suspense>
    );

  return <AttendanceWorkspaceShell tab={tab} activePanel={activePanel} />;
}

function WorkspaceFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Attendance"
        description="Loading attendance workspace…"
      />
    </div>
  );
}

export function AttendanceWorkspacePageContent(props: AttendanceWorkspacePageContentProps) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <AttendanceWorkspaceInner {...props} />
    </Suspense>
  );
}
