import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import { canUploadReportCards } from "@/config/roles";
import { siteConfig } from "@/config/site";
import {
  loadReportCardsCommandCenter,
  parseReportCardsView,
  pickReportCardsClassId,
  REPORT_CARDS_LOAD_ERROR,
} from "@/features/report-cards/load-report-cards-command-center";
import { ReportCardRegistrySection } from "@/features/report-cards/report-cards-registry";
import { ReportCardsWorkspaceShell } from "@/features/report-cards/report-cards-workspace-shell";
import { ReportCardUploadSheet } from "@/features/report-cards/report-card-upload-sheet";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function ReportCardsCommandCenter({
  role,
  searchParams,
}: {
  role: Role;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createServerSupabaseClient();
  const canUpload = canUploadReportCards(role);

  if (!supabase) {
    return (
      <div className="ns-page-shell-wide space-y-6">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Report Cards"
          description="Track reporting progress, review student reports, and manage completed records."
        />
        <p className="ns-muted" role="status">
          Report cards are unavailable right now.
        </p>
      </div>
    );
  }

  const data = await loadReportCardsCommandCenter(supabase, role);
  const classId = pickReportCardsClassId(searchParams);
  const viewFromQuery = parseReportCardsView(pickString(searchParams.view));
  const initialView = classId && viewFromQuery === "overview" ? "class" : viewFromQuery;

  return (
    <div className="ns-page-shell-wide space-y-6">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Report Cards"
        description="Track reporting progress, review student reports, and manage completed records."
        actions={
          canUpload ? (
            <ReportCardUploadSheet
              dashboardRole={role}
              suggestedSchoolYears={
                data.yearOptions.length > 0
                  ? data.yearOptions
                  : data.cycle.schoolYearLabel
                    ? [data.cycle.schoolYearLabel]
                    : undefined
              }
              defaultTerm={data.cycle.termCode ?? undefined}
            />
          ) : null
        }
      />

      {data.error && !data.overview.coverageKnown && data.classes.length === 0 ? (
        <p className="text-destructive text-sm" role="alert">
          {data.error || REPORT_CARDS_LOAD_ERROR}
        </p>
      ) : null}

      <ReportCardsWorkspaceShell
        role={role}
        cycle={data.cycle}
        overview={data.overview}
        classes={data.classes}
        students={data.students}
        teachersAvailable={data.teachersAvailable}
        yearOptions={
          data.yearOptions.length > 0
            ? data.yearOptions
            : data.cycle.schoolYearLabel
              ? [data.cycle.schoolYearLabel]
              : []
        }
        initialView={initialView}
        initialClassId={classId}
        canUpload={canUpload}
        library={
          <ReportCardRegistrySection role={role} searchParams={searchParams} />
        }
      />
    </div>
  );
}
