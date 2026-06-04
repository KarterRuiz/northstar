import { Suspense } from "react";

import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import { InterventionsDashboardView } from "./interventions-dashboard-view";
import { loadInterventionsDashboardPageData } from "./load-interventions-dashboard-data";

type InterventionsWorkspacePageContentProps = {
  classId: string | null;
};

async function InterventionsWorkspaceInner({
  classId,
}: InterventionsWorkspacePageContentProps) {
  const data = await loadInterventionsDashboardPageData({ classId });

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-6 p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Interventions"
          description="Support workflow for your assigned students."
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
    <InterventionsDashboardView
      classes={data.classes}
      classId={data.classId}
      rows={data.rows}
      summary={data.summary}
    />
  );
}

function WorkspaceFallback() {
  return (
    <div className="mx-auto w-full max-w-[100rem] p-6 sm:p-8">
      <p className="text-muted-foreground text-sm">Loading interventions…</p>
    </div>
  );
}

export function InterventionsWorkspacePageContent({
  classId,
}: InterventionsWorkspacePageContentProps) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <InterventionsWorkspaceInner classId={classId} />
    </Suspense>
  );
}
