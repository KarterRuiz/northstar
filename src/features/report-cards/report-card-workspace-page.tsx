import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import { loadReportCardWorkspacePageData } from "./load-report-card-workspace-data";
import { ReportCardWorkspaceView } from "./report-card-workspace-view";

type ReportCardWorkspacePageContentProps = {
  classId: string | null;
  term: string;
};

async function ReportCardWorkspaceInner({
  classId,
  term,
}: ReportCardWorkspacePageContentProps) {
  const data = await loadReportCardWorkspacePageData({ classId, term });

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-6 p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Report cards"
          description="Prepare term report cards for your classes."
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="font-medium">Could not load workspace.</span> {data.message}
        </div>
      </div>
    );
  }

  return (
    <ReportCardWorkspaceView
      classes={data.classes}
      classId={data.classId}
      className={data.className}
      classSubtitle={data.classSubtitle}
      schoolYearLabel={data.schoolYearLabel}
      term={data.term}
      students={data.students}
    />
  );
}

function WorkspaceFallback() {
  return (
    <div className="mx-auto w-full max-w-[100rem] p-6 sm:p-8">
      <p className="text-muted-foreground text-sm">Loading workspace…</p>
    </div>
  );
}

export function ReportCardWorkspacePageContent({
  classId,
  term,
}: ReportCardWorkspacePageContentProps) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <ReportCardWorkspaceInner classId={classId} term={term} />
    </Suspense>
  );
}

export function ReportCardWorkspaceUnavailable() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <p className="text-muted-foreground text-sm">
        Report card tools are available to teachers assigned to a class.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Back to hub</Link>
      </Button>
    </div>
  );
}
