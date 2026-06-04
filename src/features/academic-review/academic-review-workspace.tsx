import Link from "next/link";

import type { Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import {
  WorkspacePageHeader,
  WorkspaceSectionHeader,
} from "@/components/workspace/workspace-headers";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { cn } from "@/lib/utils";

import { AcademicRecordsSummarySection } from "./academic-records-summary-section";
import { academicReviewHref, mergeAcademicReviewParams } from "./academic-review-href";
import type {
  AcademicReviewResult,
  AcademicReviewRow,
  AcademicReviewSearchParams,
} from "./load-academic-review-data";

const CARD_CHROME = "border-border/70 shadow-sm";

const selectClassName = cn(
  "border-input bg-background ring-offset-background text-foreground",
  "focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
);
const linkClass =
  "text-primary text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline";
const chipBase =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150";

function ProgressTrack({
  label,
  valuePct,
  caption,
}: {
  label: string;
  valuePct: number;
  caption: string;
}) {
  const pct = Math.min(100, Math.max(0, valuePct));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="text-foreground text-xs font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">{caption}</p>
    </div>
  );
}

function transitionBadgeVariant(
  status: AcademicReviewRow["transitionNoteStatus"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "submitted") return "default";
  if (status === "draft") return "secondary";
  return "destructive";
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        chipBase,
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function AcademicReviewWorkspace({
  role,
  searchParams,
  data,
}: {
  role: Role;
  searchParams: AcademicReviewSearchParams;
  data: Extract<AcademicReviewResult, { ok: true }>;
}) {
  const { summary, filterOptions, rows, dbError } = data;
  const sp = searchParams;

  const tnActive = (sp.tn ?? "all") as string;
  const rcActive = (sp.rc ?? "all") as string;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Academic review"
        description={
          <>
            School-wide completion for the current school year ({summary.schoolYearLabel}
            ). Transition notes use{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              transition_notes
            </code>{" "}
            scoped to that year; report cards expect one PDF per student for each term in{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              {REPORT_CARD_TERMS.join(", ")}
            </code>{" "}
            in{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              report_card_files
            </code>{" "}
            (school year label + term).
          </>
        }
      />

      {dbError ? (
        <div
          className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <span className="text-foreground font-medium">Limited data.</span> {dbError}
        </div>
      ) : null}

      <section aria-labelledby="academic-review-summary">
        <WorkspaceSectionHeader
          id="academic-review-summary"
          eyebrow="Leadership"
          title="Completion snapshot"
          description="Totals are school-wide for the current year. Use filters below to focus the roster table."
          className="mb-4"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className={CARD_CHROME}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active enrollments</CardTitle>
              <CardDescription>Distinct class seats</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {summary.activeEnrollmentCount}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {summary.uniqueStudentCount} unique students
              </p>
            </CardContent>
          </Card>
          <Card className={CARD_CHROME}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Needs attention</CardTitle>
              <CardDescription>Students missing TN or any term PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {summary.needsAttentionStudentCount}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Of {summary.uniqueStudentCount} on roll
              </p>
            </CardContent>
          </Card>
          <Card className={CARD_CHROME}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transition notes</CardTitle>
              <CardDescription>Submitted for this school year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {summary.transitionSubmittedCount}
                <span className="text-muted-foreground text-lg font-normal">
                  {" "}
                  / {summary.uniqueStudentCount}
                </span>
              </p>
              <ProgressTrack
                label="Submitted"
                valuePct={summary.transitionSubmittedPct}
                caption={`${summary.transitionDraftCount} draft · ${summary.transitionMissingCount} missing`}
              />
            </CardContent>
          </Card>
          <Card className={CARD_CHROME}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Report cards</CardTitle>
              <CardDescription>All terms present</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {summary.studentsWithAllReportTerms}
                <span className="text-muted-foreground text-lg font-normal">
                  {" "}
                  / {summary.uniqueStudentCount}
                </span>
              </p>
              <ProgressTrack
                label="Slot fill (terms × students)"
                valuePct={summary.reportFilledPct}
                caption={`${summary.reportFilledSlots} of ${summary.reportExpectedSlots} term uploads · ${summary.reportAllTermsPct}% students complete`}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <AcademicRecordsSummarySection
        schoolYearLabel={summary.schoolYearLabel}
        submittedCount={summary.academicRecordSubmittedCount}
        draftCount={summary.academicRecordDraftCount}
        reviewedCount={summary.academicRecordReviewedCount}
        archivedCount={summary.academicRecordArchivedCount}
      />

      <section
        className="border-border bg-card rounded-xl border p-5 shadow-sm sm:p-6"
        aria-labelledby="academic-review-filters-heading"
      >
        <WorkspaceSectionHeader
          id="academic-review-filters-heading"
          eyebrow="Filters"
          title="Roster scope"
          description="Structure filters apply to the table only. Summary cards stay school-wide."
          className="mb-4"
        />

        <form
          className="flex flex-col gap-5"
          method="get"
          action={`/dashboard/${role}/academic-review`}
        >
          {sp.tn ? <input type="hidden" name="tn" value={sp.tn} /> : null}
          {sp.rc ? <input type="hidden" name="rc" value={sp.rc} /> : null}
          {sp.sort !== "student" ? <input type="hidden" name="sort" value={sp.sort} /> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="ar-grade">Grade</Label>
              <select
                id="ar-grade"
                name="grade"
                defaultValue={sp.gradeId ?? ""}
                className={selectClassName}
              >
                <option value="">All grades</option>
                {filterOptions.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-class">Class</Label>
              <select
                id="ar-class"
                name="class"
                defaultValue={sp.classId ?? ""}
                className={selectClassName}
              >
                <option value="">All classes</option>
                {filterOptions.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-teacher">Homeroom teacher</Label>
              <select
                id="ar-teacher"
                name="teacher"
                defaultValue={sp.teacherId ?? ""}
                className={selectClassName}
              >
                <option value="">All teachers</option>
                {filterOptions.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-sort">Sort roster by</Label>
              <select
                id="ar-sort"
                name="sort"
                defaultValue={sp.sort}
                className={selectClassName}
              >
                <option value="student">Student name</option>
                <option value="class">Class</option>
                <option value="teacher">Homeroom teacher</option>
                <option value="grade">Grade level</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium shadow-sm transition-colors hover:opacity-95"
            >
              Apply structure filters
            </button>
            <Link
              href={academicReviewHref(role, {
                gradeId: null,
                classId: null,
                teacherId: null,
                tn: sp.tn,
                rc: sp.rc,
                sort: sp.sort,
              })}
              className={linkClass}
            >
              Clear grade / class / teacher
            </Link>
          </div>
        </form>

        <div className="border-border mt-6 border-t pt-5">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Status chips (table)
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: null, rc: null }),
              )}
              active={tnActive === "all" && rcActive === "all"}
            >
              All rows
            </FilterChip>
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: "incomplete", rc: null }),
              )}
              active={tnActive === "incomplete"}
            >
              Incomplete transition notes
            </FilterChip>
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: "draft", rc: null }),
              )}
              active={tnActive === "draft"}
            >
              Draft notes
            </FilterChip>
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: "missing", rc: null }),
              )}
              active={tnActive === "missing"}
            >
              Missing notes
            </FilterChip>
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: null, rc: "incomplete" }),
              )}
              active={rcActive === "incomplete"}
            >
              Missing report cards
            </FilterChip>
            <FilterChip
              href={academicReviewHref(
                role,
                mergeAcademicReviewParams(sp, { tn: null, rc: "complete" }),
              )}
              active={rcActive === "complete"}
            >
              Report cards complete
            </FilterChip>
          </div>
        </div>
      </section>

      <section className="border-border bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <WorkspaceSectionHeader
          id="academic-review-roster-heading"
          eyebrow="Roster"
          title="Students & classes"
          description={`${rows.length} row${rows.length === 1 ? "" : "s"} match current filters.`}
          className="mb-4"
        />
        {rows.length === 0 ? (
          <ListEmptyState
            title="No rows match"
            description="Adjust filters or confirm enrollments exist for the current school year."
          />
        ) : (
          <Table aria-label="Academic completion by enrollment">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Class</TableHead>
                <TableHead className="hidden sm:table-cell">Grade</TableHead>
                <TableHead className="hidden lg:table-cell">Homeroom</TableHead>
                <TableHead>Transition</TableHead>
                <TableHead>Report cards</TableHead>
                <TableHead className="text-right">Attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Link
                      href={`/dashboard/${role}/students/${r.studentId}/overview`}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      {r.studentDisplayName}
                    </Link>
                    <div className="text-muted-foreground mt-0.5 text-xs md:hidden">
                      {r.classLabel}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[12rem] truncate text-sm md:table-cell">
                    {r.classLabel}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{r.gradeLevelName}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                    {r.homeroomTeacherLabel}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={transitionBadgeVariant(r.transitionNoteStatus)}>
                        {r.transitionNoteStatus === "submitted"
                          ? "Submitted"
                          : r.transitionNoteStatus === "draft"
                            ? "Draft"
                            : "Missing"}
                      </Badge>
                      <Link
                        href={`/dashboard/${role}/students/${r.studentId}/transition-notes`}
                        className={cn(linkClass, "text-xs")}
                      >
                        Open
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.missingReportCardTerms.length === 0 ? (
                      <Badge variant="default">All terms</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.missingReportCardTerms.map((t) => (
                          <span
                            key={t}
                            className="border-destructive/40 bg-destructive/10 text-destructive inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
                          >
                            Missing {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1">
                      <Link
                        href={`/dashboard/${role}/students/${r.studentId}/report-cards`}
                        className={cn(linkClass, "text-xs")}
                      >
                        Upload / view
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.studentNeedsAttention ? (
                      <span className="bg-destructive/15 text-destructive inline-flex rounded-md px-2 py-0.5 text-xs font-semibold">
                        Needs attention
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">OK</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <p className="text-muted-foreground text-xs leading-relaxed">
        <strong className="text-foreground">Definitions:</strong> A transition note is{" "}
        <em>missing</em> when there is no row in{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5">transition_notes</code>{" "}
        for this student with{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5">school_year_id</code> set to
        the current year. <em>Draft</em> and <em>submitted</em> match{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5">status</code>. Homeroom
        teacher is the <code className="text-foreground rounded bg-muted px-1 py-0.5">homeroom</code>{" "}
        assignment when present; otherwise the first teacher on the class. Staff labels use
        profile ids (no separate name column in schema). RLS applies to all queries.
      </p>
    </div>
  );
}
