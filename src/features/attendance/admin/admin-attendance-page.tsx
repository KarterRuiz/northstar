import { Suspense } from "react";

import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import { AdminAttendanceView } from "./admin-attendance-view";
import { loadAdminAttendanceAnalytics } from "./load-admin-attendance-analytics";
import {
  loadAdminAttendanceData,
  type AdminAttendanceSearchParams,
} from "./load-admin-attendance-data";
import { loadPositiveAttendanceSignals } from "./load-positive-attendance-signals";

async function AdminAttendanceInner(params: AdminAttendanceSearchParams) {
  const [data, positiveSignals, analytics] = await Promise.all([
    loadAdminAttendanceData(params),
    loadPositiveAttendanceSignals(params),
    loadAdminAttendanceAnalytics(params),
  ]);
  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6 sm:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Attendance monitoring"
          description="School-wide attendance operations."
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive mt-4 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {data.message}
        </div>
      </div>
    );
  }
  return (
    <AdminAttendanceView
      {...data}
      positiveSignals={positiveSignals}
      analytics={analytics.ok ? analytics : null}
      analyticsError={analytics.ok ? null : analytics.message}
    />
  );
}

function Fallback() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6 sm:p-8">
      <p className="text-muted-foreground text-sm">Loading attendance monitoring…</p>
    </div>
  );
}

export function AdminAttendancePageContent(params: AdminAttendanceSearchParams) {
  return (
    <Suspense fallback={<Fallback />}>
      <AdminAttendanceInner {...params} />
    </Suspense>
  );
}
