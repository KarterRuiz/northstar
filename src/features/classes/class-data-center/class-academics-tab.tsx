import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { GradebookView } from "@/features/teacher/gradebook/gradebook-view";
import { loadGradebookPageDataForLeadership } from "@/features/teacher/gradebook/load-gradebook-data";

import { classDataCenterAcademicReviewHref } from "./constants";
import { loadClassDataCenterContext } from "./load-class-data-center-context";

/**
 * Leadership Academics — read-only gradebook review.
 * Mutations remain blocked by requireTeacherAssignedToClass on gradebook actions.
 */
export async function ClassDataCenterAcademicsTab({ classId }: { classId: string }) {
  const ctx = await loadClassDataCenterContext(classId);
  if (!ctx.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not open academics.</span> {ctx.message}
      </div>
    );
  }

  const data = await loadGradebookPageDataForLeadership(classId);
  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load academics.</span> {data.message}
      </div>
    );
  }

  const reviewHref = classDataCenterAcademicReviewHref(ctx.context.role, classId);
  const empty =
    data.assignments.length === 0 && data.scores.length === 0 && data.categories.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceSectionHeader
          title="Academics"
          description="Read-only review of class grades. Teachers enter and update scores in their gradebook."
        />
        <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
          <Link href={reviewHref}>Open in Academic Review</Link>
        </Button>
      </div>

      {empty ? (
        <ListEmptyState
          title="No grades recorded yet."
          description="When teachers add categories, assignments, and scores, they appear here for leadership review."
        />
      ) : (
        <GradebookView
          mode="read-only"
          embedded
          classId={data.classId}
          className={data.className}
          classSubtitle={data.classSubtitle}
          schoolYearLabel={data.schoolYearLabel}
          reportReadinessByStudent={data.reportReadinessByStudent}
          categories={data.categories}
          assignments={data.assignments}
          scores={data.scores}
          students={data.students}
        />
      )}
    </div>
  );
}
