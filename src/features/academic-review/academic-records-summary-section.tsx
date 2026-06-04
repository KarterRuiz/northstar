import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CARD_CHROME = "border-border/70 shadow-sm";

type AcademicRecordsSummarySectionProps = {
  schoolYearLabel: string;
  submittedCount: number;
  draftCount: number;
  reviewedCount: number;
  archivedCount: number;
};

export function AcademicRecordsSummarySection({
  schoolYearLabel,
  submittedCount,
  draftCount,
  reviewedCount,
  archivedCount,
}: AcademicRecordsSummarySectionProps) {
  const pendingReviewCount = submittedCount;
  const total = submittedCount + draftCount + reviewedCount + archivedCount;
  const completePct =
    total > 0 ? Math.round((reviewedCount / total) * 1000) / 10 : 0;

  return (
    <section aria-labelledby="academic-records-summary-heading" className="mt-6">
      <h2
        id="academic-records-summary-heading"
        className="text-foreground mb-4 text-lg font-semibold tracking-tight"
      >
        Structured academic records
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total entries</CardTitle>
            <CardDescription>{schoolYearLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{total}</p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending review</CardTitle>
            <CardDescription>Submitted, not yet reviewed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {pendingReviewCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {draftCount} draft · {submittedCount} in queue
            </p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reviewed</CardTitle>
            <CardDescription>Leadership marked complete</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {reviewedCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{completePct}% of entries</p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Source table</CardTitle>
            <CardDescription>Teacher-entered rows</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Counts from{" "}
              <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
                academic_records
              </code>{" "}
              for the current school year. Does not replace PDF report card uploads.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
