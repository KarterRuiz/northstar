import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isRole, type Role } from "@/config/roles";
import { loadReportCardPreviewData } from "@/features/report-cards/load-report-card-workspace-data";
import { ReportCardPrintPreview } from "@/features/report-cards/report-card-print-preview";
import { REPORT_CARD_TERMS, isReportCardTerm } from "@/lib/report-cards/constants";
import { isStudentId, isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Report card preview",
  description: "Printable report card preview shell.",
};

/** Puppeteer PDF generation in the save server action. */
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ReportCardPreviewRoute({
  params,
  searchParams,
}: PageProps) {
  const { role: roleRaw, studentId } = await params;
  const sp = await searchParams;
  if (!isRole(roleRaw)) notFound();
  const role = roleRaw as Role;
  if (role !== "teacher") notFound();
  if (!isStudentId(studentId)) notFound();

  const classId = pickString(sp.classId);
  if (!classId || !isUuid(classId)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <p className="text-muted-foreground text-sm">
          Open preview from Report cards with a class selected.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/teacher/report-cards">Report cards</Link>
        </Button>
      </div>
    );
  }

  const termRaw = pickString(sp.term);
  const term =
    termRaw && isReportCardTerm(termRaw) ? termRaw : REPORT_CARD_TERMS[0];

  const data = await loadReportCardPreviewData({
    classId,
    studentId,
    term,
  });

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <p className="text-destructive text-sm">{data.message}</p>
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/dashboard/teacher/report-cards?classId=${classId}&term=${term}`}
          >
            Back to report cards
          </Link>
        </Button>
      </div>
    );
  }

  const backHref = `/dashboard/teacher/report-cards?classId=${classId}&term=${term}`;

  const preview = data.data;

  return (
    <ReportCardPrintPreview
      {...preview}
      backHref={backHref}
      settingsHref={null}
    />
  );
}
