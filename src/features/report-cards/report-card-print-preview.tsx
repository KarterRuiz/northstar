"use client";

/**
 * Printable student snapshot report card (browser print + server PDF archive).
 */
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { attendanceRiskTierLabels } from "@/features/attendance/attendance-risk-tier";
import {
  formatOverallGrade,
  formatPercent,
} from "@/features/teacher/gradebook/calculations";

import type { ReportCardPreviewPayload } from "./types";

import "./report-card-print.css";

const ReportCardArchiveControls = dynamic(
  () =>
    import("./report-card-archive-controls").then((m) => m.ReportCardArchiveControls),
  {
    ssr: false,
    loading: () => (
      <span className="text-muted-foreground text-xs tabular-nums" aria-hidden>
        Loading save…
      </span>
    ),
  },
);

export const REPORT_CARD_PRINT_ROOT_ID = "report-card-print-root";

type ReportCardPrintPreviewProps = ReportCardPreviewPayload & {
  backHref: string;
  settingsHref?: string | null;
};

function contactLines(
  branding: ReportCardPreviewPayload["branding"],
): string[] {
  const lines: string[] = [];
  if (branding.schoolAddress) lines.push(branding.schoolAddress);
  const phoneEmail = [branding.schoolPhone, branding.schoolEmail]
    .filter(Boolean)
    .join(" · ");
  if (phoneEmail) lines.push(phoneEmail);
  if (branding.website) lines.push(branding.website);
  return lines;
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Section({
  title,
  children,
  breakable = false,
}: {
  title: string;
  children: ReactNode;
  breakable?: boolean;
}) {
  return (
    <section
      className={`rc-section mt-6${breakable ? " rc-section-breakable" : ""}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function ReportCardPrintPreview({
  backHref,
  settingsHref,
  ...payload
}: ReportCardPrintPreviewProps) {
  const {
    classId,
    className,
    classSubtitle,
    gradeLevel,
    schoolYearLabel,
    term,
    studentId,
    studentDisplayName,
    studentNumber,
    teacherName,
    readiness,
    comment,
    branding,
    categoryAverages,
    assignmentSummary,
    attendance,
    behavior,
    interventions,
    supportFlags,
    transitionSummary,
    dataCurrentAsOf,
  } = payload;

  const contact = contactLines(branding);
  const headerStyle = { borderBottomColor: branding.primaryColor } as const;
  const generatedOn = formatDisplayDate(dataCurrentAsOf);
  const dataAsOf = formatDisplayDate(dataCurrentAsOf);
  const termIncomplete =
    readiness.isPartialGrade ||
    readiness.missingAssignmentCount > 0 ||
    readiness.categoriesWithoutScores.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>Back to report cards</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
          <ReportCardArchiveControls
            studentId={studentId}
            classId={classId}
            schoolYear={schoolYearLabel}
            term={term}
            readinessStatus={readiness.status}
            printTargetId={REPORT_CARD_PRINT_ROOT_ID}
          />
        </div>
      </div>

      {!branding.isConfigured ? (
        <p className="border-amber-500/40 bg-amber-500/10 text-amber-950 rounded-md border px-3 py-2 text-sm print:hidden dark:text-amber-100">
          School profile is not fully configured. Report cards use placeholder branding until
          {settingsHref ? (
            <>
              {" "}
              <Link href={settingsHref} className="font-medium underline underline-offset-2">
                school settings
              </Link>{" "}
              are completed.
            </>
          ) : (
            " school leadership completes institution settings."
          )}
        </p>
      ) : null}

      <article
        id={REPORT_CARD_PRINT_ROOT_ID}
        className="report-card-print-root border bg-white p-8 text-black shadow-sm print:border-0 print:p-0 print:shadow-none"
      >
        <header className="border-b-2 pb-4 print:border-gray-300" style={headerStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1
                className="text-2xl font-semibold tracking-tight"
                style={{ color: branding.primaryColor }}
              >
                {branding.schoolName}
              </h1>
              {contact.length > 0 ? (
                <div className="text-muted-foreground mt-2 space-y-0.5 text-xs print:text-gray-600">
                  {contact.map((line) => (
                    <p key={line} className="whitespace-pre-wrap">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            {branding.logoSignedUrl ? (
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logoSignedUrl}
                  alt=""
                  className="max-h-16 max-w-[10rem] object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-4 text-xs uppercase tracking-wide print:text-gray-600">
            Report card · {schoolYearLabel} · Term {term}
          </p>
          <p className="text-muted-foreground mt-1 text-xs print:text-gray-600">
            Generated {generatedOn} · Data current as of {dataAsOf}
          </p>
        </header>

        <Section title="Student information">
          <p className="text-lg font-semibold">{studentDisplayName}</p>
          <p className="mt-1 text-sm">
            {className}
            {classSubtitle ? ` · ${classSubtitle}` : ""}
          </p>
          <p className="text-sm text-gray-700">
            Grade {gradeLevel}
            {teacherName ? ` · Teacher: ${teacherName}` : ""}
            {studentNumber ? ` · Student #: ${studentNumber}` : ""}
          </p>
        </Section>

        <Section title="Academic summary">
          <p className="text-lg tabular-nums">
            {readiness.overallPercent !== null
              ? formatOverallGrade({
                  percent: readiness.overallPercent,
                  letter: readiness.overallLetter,
                  isPartial: readiness.isPartialGrade,
                })
              : "—"}
          </p>
          {termIncomplete ? (
            <p className="text-muted-foreground mt-2 text-xs print:text-gray-600">
              Term grade data may be incomplete (
              {readiness.missingAssignmentCount > 0
                ? `${readiness.missingAssignmentCount} missing assignment${readiness.missingAssignmentCount === 1 ? "" : "s"}`
                : null}
              {readiness.missingAssignmentCount > 0 &&
              readiness.categoriesWithoutScores.length > 0
                ? "; "
                : null}
              {readiness.categoriesWithoutScores.length > 0
                ? `categories without scores: ${readiness.categoriesWithoutScores.join(", ")}`
                : null}
              ).
            </p>
          ) : null}
          {categoryAverages.length > 0 ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-[10px] uppercase tracking-wide print:border-gray-300 print:text-gray-600">
                  <th className="py-1 pr-4 font-medium">Category</th>
                  <th className="py-1 text-right font-medium">Average</th>
                </tr>
              </thead>
              <tbody>
                {categoryAverages.map((row) => (
                  <tr key={row.name} className="border-b border-gray-100 print:border-gray-200">
                    <td className="py-1.5 pr-4">{row.name}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {row.percent !== null
                        ? `${formatPercent(row.percent)}${row.letter ? ` ${row.letter}` : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">No category averages recorded.</p>
          )}
          <p className="mt-3 text-sm">
            Assignments: {assignmentSummary.gradedCount} of {assignmentSummary.totalInTerm}{" "}
            graded
            {assignmentSummary.missingCount > 0
              ? ` · ${assignmentSummary.missingCount} missing`
              : ""}
          </p>
        </Section>

        <Section title="Attendance summary">
          {attendance ? (
            <p className="text-sm leading-relaxed">
              Term to date:{" "}
              {attendance.termAttendancePct !== null
                ? `${attendance.termAttendancePct}% present`
                : "No attendance marks yet"}
              {" · "}
              {attendance.termAbsences} absence
              {attendance.termAbsences === 1 ? "" : "s"}
              {" · "}
              {attendance.termTardies} tard
              {attendance.termTardies === 1 ? "y" : "ies"}
              {attendance.termExcused > 0 ? ` · ${attendance.termExcused} excused` : ""}
              {attendance.termPartial > 0 ? ` · ${attendance.termPartial} partial` : ""}
              {attendance.riskTier && attendance.riskTier !== "healthy" ? (
                <>
                  {" · "}
                  Risk: {attendanceRiskTierLabels[attendance.riskTier]}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm">No attendance data recorded for this term.</p>
          )}
        </Section>

        <Section title="Behavior / support summary">
          {!behavior.hasRecords ? (
            <p className="text-sm">No behavior/support records entered.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {behavior.positiveRecognitions.length > 0 ? (
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide print:text-gray-600">
                    Positive recognitions
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {behavior.positiveRecognitions.map((r) => (
                      <li key={`${r.date}-${r.title}`}>
                        {r.date}: {r.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {behavior.concerns.length > 0 ? (
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide print:text-gray-600">
                    Concerns / support notes
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {behavior.concerns.map((r) => (
                      <li key={`${r.date}-${r.title}`}>
                        {r.date}: {r.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {behavior.parentContacts.length > 0 ? (
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide print:text-gray-600">
                    Parent contacts
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {behavior.parentContacts.map((r) => (
                      <li key={`${r.date}-${r.title}`}>
                        {r.date}: {r.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Section>

        <Section title="Interventions / supports">
          {interventions.active.length === 0 && interventions.recentlyResolved.length === 0 ? (
            <p className="text-sm">No active interventions on file.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {interventions.active.length > 0 ? (
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide print:text-gray-600">
                    Active
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {interventions.active.map((i) => (
                      <li key={i.title}>
                        {i.title} ({i.status})
                        {i.followUpDate ? ` · Follow-up ${i.followUpDate}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {interventions.recentlyResolved.length > 0 ? (
                <div>
                  <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide print:text-gray-600">
                    Recently resolved
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {interventions.recentlyResolved.map((i) => (
                      <li key={i.title}>
                        {i.title}
                        {i.resolvedAt ? ` · Resolved ${i.resolvedAt.slice(0, 10)}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
          {supportFlags.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs print:text-gray-600">
              Support flags: {supportFlags.map((f) => f.label).join(" · ")}
            </p>
          ) : null}
        </Section>

        <Section title="Transition note" breakable>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {transitionSummary?.trim()
              ? transitionSummary
              : "No transition note submitted."}
          </p>
        </Section>

        <Section title="Teacher narrative" breakable>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {comment?.narrativeComment?.trim()
              ? comment.narrativeComment
              : "No teacher narrative entered yet."}
          </p>
        </Section>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide print:text-gray-600">
              Teacher signature
            </p>
            <div className="mt-6 border-b border-gray-400" />
            <p className="mt-2 text-sm">{teacherName ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide print:text-gray-600">
              Date
            </p>
            <div className="mt-6 border-b border-gray-400" />
            <p className="mt-2 text-sm">{generatedOn}</p>
          </div>
        </div>

        {branding.principalName ? (
          <div className="mt-8">
            <p className="text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide print:text-gray-600">
                Principal
              </span>
              <span className="mt-1 block font-medium">{branding.principalName}</span>
            </p>
          </div>
        ) : null}

        <footer className="text-muted-foreground mt-10 border-t pt-4 text-[10px] print:border-gray-300 print:text-gray-500">
          {branding.reportCardFooter ? (
            <p className="whitespace-pre-wrap">{branding.reportCardFooter}</p>
          ) : null}
          <p className={branding.reportCardFooter ? "mt-2" : ""}>
            This report card reflects student information available in {siteConfig.shortName} at
            the time it was generated.
          </p>
          <p className="mt-1">
            Generated by {siteConfig.shortName} · {generatedOn}
          </p>
        </footer>
      </article>
    </div>
  );
}
