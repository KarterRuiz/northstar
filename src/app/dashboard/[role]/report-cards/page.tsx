import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  canSearchReportCardRegistry,
  canUploadReportCards,
  isRole,
  type Role,
} from "@/config/roles";
import { siteConfig } from "@/config/site";
import { ReportCardsCommandCenter } from "@/features/report-cards/report-cards-command-center";
import { ReportCardWorkspacePageContent } from "@/features/report-cards/report-card-workspace-page";
import { ReportCardUploadSheet } from "@/features/report-cards/report-card-upload-sheet";
import { REPORT_CARD_TERMS, isReportCardTerm } from "@/lib/report-cards/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ReportCardsPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleRaw } = await params;
  const sp = await searchParams;
  if (!isRole(roleRaw)) notFound();
  const role = roleRaw as Role;

  const showUpload = canUploadReportCards(role);
  const showRegistry = canSearchReportCardRegistry(role);

  if (role === "teacher") {
    const classIdRaw = pickString(sp.classId) ?? pickString(sp.class);
    const classId = classIdRaw && isUuid(classIdRaw) ? classIdRaw : null;
    const termRaw = pickString(sp.term);
    const term =
      termRaw && isReportCardTerm(termRaw) ? termRaw : REPORT_CARD_TERMS[0];

    const supabase = await createServerSupabaseClient();
    const yearsRes = supabase
      ? await supabase
          .from("school_years")
          .select("label")
          .is("archived_at", null)
          .order("starts_on", { ascending: false })
      : { data: [] as { label: string }[] };
    const yearOptions = (yearsRes.data ?? [])
      .map((y) => y.label?.trim())
      .filter((label): label is string => Boolean(label));

    return (
      <div className="space-y-0">
        <ReportCardWorkspacePageContent classId={classId} term={term} />
        {showUpload ? (
          <section className="border-border/60 mx-auto w-full max-w-[100rem] border-t px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-heading text-base font-semibold">
                  Upload a PDF
                </h2>
                <p className="ns-muted max-w-xl">
                  Attach or replace an official report card for a student in your
                  classes.
                </p>
              </div>
              <ReportCardUploadSheet
                dashboardRole={role}
                defaultTerm={term}
                suggestedSchoolYears={yearOptions}
              />
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (!showUpload && !showRegistry) {
    return (
      <div className="ns-page-shell space-y-6">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Report Cards"
          description="Track reporting progress, review student reports, and manage completed records."
        />
        <p className="ns-muted">
          Report card tools are not available in this workspace.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to hub</Link>
        </Button>
      </div>
    );
  }

  return <ReportCardsCommandCenter role={role} searchParams={sp} />;
}
