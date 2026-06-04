import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  canSearchReportCardRegistry,
  canUploadReportCards,
  isRole,
  type Role,
} from "@/config/roles";
import { ReportCardWorkspacePageContent } from "@/features/report-cards/report-card-workspace-page";
import { ReportCardRegistrySection } from "@/features/report-cards/report-cards-registry";
import { ReportCardUploadForm } from "@/features/report-cards/report-card-upload-form";
import { REPORT_CARD_TERMS, isReportCardTerm } from "@/lib/report-cards/constants";
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
    const classIdRaw = pickString(sp.classId);
    const classId =
      classIdRaw && isUuid(classIdRaw) ? classIdRaw : null;
    const termRaw = pickString(sp.term);
    const term =
      termRaw && isReportCardTerm(termRaw) ? termRaw : REPORT_CARD_TERMS[0];

    return (
      <>
        <ReportCardWorkspacePageContent classId={classId} term={term} />
        {showUpload ? (
          <section
            id="report-card-upload"
            className="border-border/60 mx-auto w-full max-w-[100rem] border-t px-6 pt-10 pb-8 sm:px-8"
          >
            <div className="mb-6 space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">Upload PDFs</h2>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Upload official report card PDFs to the private storage bucket and manage
                draft and final states per student.
              </p>
            </div>
            <ReportCardUploadForm dashboardRole={role} />
          </section>
        ) : null}
      </>
    );
  }

  if (!showUpload && !showRegistry) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
        <p className="text-muted-foreground text-sm">
          Report card tools are not available in this workspace.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to hub</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 p-6 sm:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Report cards
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Upload PDFs to the private storage bucket, manage draft and final states,
          and search the full library when your role includes records oversight.
        </p>
      </header>

      {showUpload ? <ReportCardUploadForm dashboardRole={role} /> : null}

      {showRegistry ? (
        <ReportCardRegistrySection role={role} searchParams={sp} />
      ) : null}
    </div>
  );
}
