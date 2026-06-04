import { Suspense } from "react";
import { redirect } from "next/navigation";

import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import { SupportBoardView } from "./support-board-view";
import { loadBehaviorPageData } from "./load-behavior-page-data";

type BehaviorWorkspacePageContentProps = {
  classId: string | null;
  studentId: string | null;
};

async function BehaviorWorkspaceInner(props: BehaviorWorkspacePageContentProps) {
  const data = await loadBehaviorPageData({
    classId: props.classId,
    studentId: props.studentId,
    severity: null,
    behaviorType: null,
    dateFrom: null,
    dateTo: null,
  });

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Student support board"
          description="Quick coaching moments for your classes — strengths, check-ins, and strategies."
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="font-medium">Could not load support board.</span> {data.message}
        </div>
      </div>
    );
  }

  if (data.classes.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Student support board"
          description="When you are assigned to an active class, your roster and quick support tools will appear here."
        />
      </div>
    );
  }

  const classOk = Boolean(props.classId && data.classes.some((c) => c.id === props.classId));
  if (!classOk) {
    const q = new URLSearchParams();
    q.set("classId", data.classes[0].id);
    if (props.studentId) q.set("studentId", props.studentId);
    redirect(`/dashboard/teacher/behavior?${q}`);
  }

  const effectiveClassId = props.classId!;

  return (
    <SupportBoardView
      key={[effectiveClassId, props.studentId ?? ""].join("|")}
      classes={data.classes}
      classId={effectiveClassId}
      rows={data.rows}
      students={data.students}
      viewerDisplayName={data.viewerDisplayName}
      urlStudentId={props.studentId}
      supportBoardByStudentId={data.supportBoardByStudentId}
    />
  );
}

function WorkspaceFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6 sm:p-8">
      <p className="text-muted-foreground text-sm">Loading support board…</p>
    </div>
  );
}

export function BehaviorWorkspacePageContent(props: BehaviorWorkspacePageContentProps) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <BehaviorWorkspaceInner {...props} />
    </Suspense>
  );
}
