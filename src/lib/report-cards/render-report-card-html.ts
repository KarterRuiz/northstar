import "server-only";

import { siteConfig } from "@/config/site";
import { attendanceRiskTierLabels } from "@/features/attendance/attendance-risk-tier";
import type { ReportCardPreviewPayload } from "@/features/report-cards/types";
import {
  formatOverallGrade,
  formatPercent,
} from "@/features/teacher/gradebook/calculations";

import { escapeHtml } from "./escape-html";
import { REPORT_CARD_PRINT_STYLES } from "./report-card-print-styles";

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

function section(title: string, body: string, breakable = false): string {
  const cls = breakable ? "rc-section rc-section-breakable" : "rc-section";
  return `<section class="${cls}"><h3 class="rc-section-title">${escapeHtml(title)}</h3>${body}</section>`;
}

function listBlock(
  heading: string,
  items: { date: string; title: string }[],
): string {
  if (items.length === 0) return "";
  return `<div><p class="rc-subheading">${escapeHtml(heading)}</p><ul class="rc-list">${items
    .map((r) => `<li>${escapeHtml(r.date)}: ${escapeHtml(r.title)}</li>`)
    .join("")}</ul></div>`;
}

export type RenderReportCardHtmlArgs = {
  payload: ReportCardPreviewPayload;
  logoDataUrl?: string | null;
};

export function renderReportCardHtml(args: RenderReportCardHtmlArgs): string {
  const { payload, logoDataUrl } = args;
  const {
    className,
    classSubtitle,
    gradeLevel,
    schoolYearLabel,
    term,
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

  const primary = branding.primaryColor || "#1e3a5f";
  const contact = contactLines(branding);
  const generatedOn = formatDisplayDate(dataCurrentAsOf);
  const dataAsOf = formatDisplayDate(dataCurrentAsOf);
  const termIncomplete =
    readiness.isPartialGrade ||
    readiness.missingAssignmentCount > 0 ||
    readiness.categoriesWithoutScores.length > 0;

  const contactBlock =
    contact.length > 0
      ? `<div class="rc-contact">${contact.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`
      : "";

  const categoryRows = categoryAverages
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${
          row.percent !== null
            ? `${escapeHtml(formatPercent(row.percent))}${row.letter ? ` ${escapeHtml(row.letter)}` : ""}`
            : "—"
        }</td>
      </tr>`,
    )
    .join("");

  const academicBody = `
    <p class="rc-grade-lg">${
      readiness.overallPercent !== null
        ? escapeHtml(
            formatOverallGrade({
              percent: readiness.overallPercent,
              letter: readiness.overallLetter,
              isPartial: readiness.isPartialGrade,
            }),
          )
        : "—"
    }</p>
    ${
      termIncomplete
        ? `<p class="rc-muted" style="margin-top:0.5rem;font-size:0.75rem;">Term grade data may be incomplete (${
            readiness.missingAssignmentCount > 0
              ? `${readiness.missingAssignmentCount} missing assignment${readiness.missingAssignmentCount === 1 ? "" : "s"}`
              : ""
          }${
            readiness.missingAssignmentCount > 0 &&
            readiness.categoriesWithoutScores.length > 0
              ? "; "
              : ""
          }${
            readiness.categoriesWithoutScores.length > 0
              ? `categories without scores: ${escapeHtml(readiness.categoriesWithoutScores.join(", "))}`
              : ""
          }).</p>`
        : ""
    }
    ${
      categoryAverages.length > 0
        ? `<table class="rc-table"><thead><tr><th>Category</th><th>Average</th></tr></thead><tbody>${categoryRows}</tbody></table>`
        : `<p class="rc-muted" style="margin-top:0.5rem;">No category averages recorded.</p>`
    }
    <p style="margin-top:0.75rem;font-size:0.875rem;">Assignments: ${assignmentSummary.gradedCount} of ${assignmentSummary.totalInTerm} graded${
      assignmentSummary.missingCount > 0
        ? ` · ${assignmentSummary.missingCount} missing`
        : ""
    }</p>`;

  const attendanceBody = attendance
    ? `<p class="rc-muted" style="line-height:1.625;">Term to date: ${
        attendance.termAttendancePct !== null
          ? `${attendance.termAttendancePct}% present`
          : "No attendance marks yet"
      } · ${attendance.termAbsences} absence${attendance.termAbsences === 1 ? "" : "s"} · ${attendance.termTardies} tard${attendance.termTardies === 1 ? "y" : "ies"}${
        attendance.termExcused > 0 ? ` · ${attendance.termExcused} excused` : ""
      }${
        attendance.termPartial > 0 ? ` · ${attendance.termPartial} partial` : ""
      }${
        attendance.riskTier && attendance.riskTier !== "healthy"
          ? ` · Risk: ${escapeHtml(attendanceRiskTierLabels[attendance.riskTier])}`
          : ""
      }</p>`
    : `<p class="rc-muted">No attendance data recorded for this term.</p>`;


  const interventionParts: string[] = [];
  if (interventions.active.length > 0) {
    interventionParts.push(`
      <div>
        <p class="rc-subheading">Active</p>
        <ul class="rc-list">${interventions.active
          .map(
            (i) =>
              `<li>${escapeHtml(i.title)} (${escapeHtml(i.status)})${i.followUpDate ? ` · Follow-up ${escapeHtml(i.followUpDate)}` : ""}</li>`,
          )
          .join("")}</ul>
      </div>`);
  }
  if (interventions.recentlyResolved.length > 0) {
    interventionParts.push(`
      <div>
        <p class="rc-subheading">Recently resolved</p>
        <ul class="rc-list">${interventions.recentlyResolved
          .map(
            (i) =>
              `<li>${escapeHtml(i.title)}${i.resolvedAt ? ` · Resolved ${escapeHtml(i.resolvedAt.slice(0, 10))}` : ""}</li>`,
          )
          .join("")}</ul>
      </div>`);
  }

  const interventionsBody =
    interventions.active.length === 0 && interventions.recentlyResolved.length === 0
      ? `<p class="rc-muted">No active interventions on file.</p>`
      : `${interventionParts.join("")}${
          supportFlags.length > 0
            ? `<p class="rc-muted" style="margin-top:0.5rem;font-size:0.75rem;">Support flags: ${escapeHtml(supportFlags.map((f) => f.label).join(" · "))}</p>`
            : ""
        }`;

  const narrative = comment?.narrativeComment?.trim()
    ? escapeHtml(comment.narrativeComment)
    : "No teacher narrative entered yet.";

  const transition = transitionSummary?.trim()
    ? escapeHtml(transitionSummary)
    : "No transition note submitted.";

  const behaviorHtml = !behavior.hasRecords
    ? `<p class="rc-muted">No behavior/support records entered.</p>`
    : `<div style="display:flex;flex-direction:column;gap:0.75rem;">
        ${listBlock("Positive recognitions", behavior.positiveRecognitions)}
        ${listBlock("Concerns / support notes", behavior.concerns)}
        ${listBlock("Parent contacts", behavior.parentContacts)}
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Report card · ${escapeHtml(term)} · ${escapeHtml(studentDisplayName)}</title>
  <style>
    :root { --rc-primary: ${escapeHtml(primary)}; }
    ${REPORT_CARD_PRINT_STYLES}
  </style>
</head>
<body>
  <article class="report-card-print-root">
    <header class="rc-header">
      <div class="rc-header-top">
        <div style="min-width:0;flex:1;">
          <h1 class="rc-school-name">${escapeHtml(branding.schoolName)}</h1>
          ${contactBlock}
        </div>
        ${logoDataUrl ? `<div class="rc-logo"><img src="${logoDataUrl}" alt="" /></div>` : ""}
      </div>
      <p class="rc-meta">Report card · ${escapeHtml(schoolYearLabel)} · Term ${escapeHtml(term)}</p>
      <p class="rc-meta rc-meta-sub">Generated ${escapeHtml(generatedOn)} · Data current as of ${escapeHtml(dataAsOf)}</p>
    </header>

    ${section(
      "Student information",
      `<p class="rc-student-name">${escapeHtml(studentDisplayName)}</p>
      <p class="rc-muted" style="margin-top:0.25rem;">${escapeHtml(className)}${classSubtitle ? ` · ${escapeHtml(classSubtitle)}` : ""}</p>
      <p class="rc-muted">Grade ${escapeHtml(gradeLevel)}${teacherName ? ` · Teacher: ${escapeHtml(teacherName)}` : ""}${studentNumber ? ` · Student #: ${escapeHtml(studentNumber)}` : ""}</p>`,
    )}

    ${section("Academic summary", academicBody)}
    ${section("Attendance summary", attendanceBody)}
    ${section("Behavior / support summary", behaviorHtml)}
    ${section("Interventions / supports", interventionsBody)}
    ${section("Transition note", `<p class="rc-pre">${transition}</p>`, true)}
    ${section("Teacher narrative", `<p class="rc-pre">${narrative}</p>`, true)}

    <div class="rc-signatures">
      <div>
        <p class="rc-subheading">Teacher signature</p>
        <div class="rc-sig-line"></div>
        <p style="margin-top:0.5rem;font-size:0.875rem;">${escapeHtml(teacherName ?? "—")}</p>
      </div>
      <div>
        <p class="rc-subheading">Date</p>
        <div class="rc-sig-line"></div>
        <p style="margin-top:0.5rem;font-size:0.875rem;">${escapeHtml(generatedOn)}</p>
      </div>
    </div>

    ${
      branding.principalName
        ? `<div style="margin-top:2rem;">
            <p class="rc-subheading">Principal</p>
            <p style="font-weight:500;margin:0.25rem 0 0;">${escapeHtml(branding.principalName)}</p>
          </div>`
        : ""
    }

    <footer class="rc-footer">
      ${branding.reportCardFooter ? `<p>${escapeHtml(branding.reportCardFooter)}</p>` : ""}
      <p>This report card reflects student information available in ${escapeHtml(siteConfig.shortName)} at the time it was generated.</p>
      <p>Generated by ${escapeHtml(siteConfig.shortName)} · ${escapeHtml(generatedOn)}</p>
    </footer>
  </article>
</body>
</html>`;
}
