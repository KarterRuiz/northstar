import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/config/roles";
import {
  categoryAveragePercent,
  formatOverallGrade,
  formatPercent,
  overallGradeMeta,
} from "@/features/teacher/gradebook/calculations";
import {
  mapGradebookAssignmentsForCalc,
  mapGradebookCategoriesForCalc,
} from "@/features/teacher/gradebook/gradebook-calc-mappers";
import { buildScoreMap } from "@/features/teacher/gradebook/gradebook-utils";
import {
  reportReadinessStatusLabel,
  type ReportReadinessStatus,
} from "@/features/teacher/gradebook/report-readiness";

import { loadStudentIntelligence } from "./load-student-intelligence";
import { ProfileEmptyState } from "./profile-empty-state";

const CARD_CHROME = "border-border/70 shadow-sm";
const TH = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

type StudentGradebookSummaryProps = {
  studentId: string;
  role: Role;
  showReadinessDetail?: boolean;
};

function readinessVariant(
  status: ReportReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "needs_grades") return "destructive";
  if (status === "missing_transition_note") return "secondary";
  return "outline";
}

export async function StudentGradebookSummary({
  studentId,
  role,
  showReadinessDetail = false,
}: StudentGradebookSummaryProps) {
  const intel = await loadStudentIntelligence(studentId, { viewerRole: role });

  if (intel.kind === "unconfigured") {
    return (
      <Card className={CARD_CHROME}>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Supabase is not configured.</p>
        </CardContent>
      </Card>
    );
  }

  if (intel.kind === "error") {
    return (
      <Card className={CARD_CHROME}>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm" role="alert">
            {intel.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (intel.kind === "no_enrollment") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-base">Gradebook summary</CardTitle>
          <CardDescription>
            Running grades require an active class enrollment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEmptyState
            icon={BookOpen}
            title="Not enrolled in a class"
            description="When this student is enrolled, gradebook scores and running grades appear here using the same calculations as the class gradebook."
          />
        </CardContent>
      </Card>
    );
  }

  const {
    categories,
    assignments,
    scores,
    readiness,
    className,
    classSubtitle,
    gradebookHref,
    recentAssignments,
  } = intel.data;

  const assignmentsForCalc = mapGradebookAssignmentsForCalc(assignments);
  const categoriesForCalc = mapGradebookCategoriesForCalc(categories);
  const scoreMap = buildScoreMap(scores);

  const overall = overallGradeMeta({
    categories: categoriesForCalc,
    assignments: assignmentsForCalc,
    scoresByAssignmentId: scoreMap,
    studentId,
    termFilter: null,
  });

  return (
    <div className="space-y-5">
      <Card className={CARD_CHROME}>
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Gradebook summary</CardTitle>
            <CardDescription>
              Read-only view for{" "}
              <span className="text-foreground font-medium">{className}</span>
              {classSubtitle ? ` · ${classSubtitle}` : ""}. Uses the same running-grade
              and readiness rules as the class gradebook.
            </CardDescription>
          </div>
          {gradebookHref ? (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={gradebookHref}>
                Open class gradebook
                <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Running grade
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatOverallGrade(overall)}
              </p>
              {overall.isPartial ? (
                <p className="text-muted-foreground text-xs">Partial — renormalized weights</p>
              ) : null}
            </div>
            <div className="border-border/60 h-10 border-l" aria-hidden />
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Report readiness
              </p>
              <Badge variant={readinessVariant(readiness.status)} className="mt-1">
                {reportReadinessStatusLabel[readiness.status]}
              </Badge>
            </div>
          </div>

          {categories.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TH}>Category</TableHead>
                    <TableHead className={TH}>Weight</TableHead>
                    <TableHead className={TH}>Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => {
                    const avg = categoryAveragePercent({
                      assignments: assignmentsForCalc,
                      scoresByAssignmentId: scoreMap,
                      studentId,
                      categoryId: cat.id,
                      termFilter: null,
                    });
                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums text-sm">
                          {cat.weightPercent}%
                        </TableCell>
                        <TableCell className="tabular-nums">{formatPercent(avg)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No gradebook categories yet.</p>
          )}

          {showReadinessDetail && readiness.categoriesWithoutScores.length > 0 ? (
            <p className="text-amber-900 text-xs dark:text-amber-100">
              Categories without scores: {readiness.categoriesWithoutScores.join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {recentAssignments.length > 0 ? (
        <Card className={CARD_CHROME}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Recent assignments</CardTitle>
            <CardDescription>Latest items from the class gradebook.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Assignment</TableHead>
                  <TableHead className={`${TH} hidden sm:table-cell`}>Category</TableHead>
                  <TableHead className={`${TH} hidden md:table-cell`}>Due</TableHead>
                  <TableHead className={TH}>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAssignments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {row.categoryName}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {row.dueDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.scoreStatus === "missing" || row.scoreStatus === "unentered"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {row.scoreLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
