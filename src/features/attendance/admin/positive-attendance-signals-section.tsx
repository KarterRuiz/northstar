import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { attendanceRiskTierLabels } from "@/features/attendance/attendance-risk-tier";

import type { PositiveAttendanceSignals } from "./load-positive-attendance-signals";

type PositiveAttendanceSignalsSectionProps = {
  signals: PositiveAttendanceSignals;
};

export function PositiveAttendanceSignalsSection({
  signals,
}: PositiveAttendanceSignalsSectionProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Positive attendance signals</CardTitle>
        <CardDescription>
          Encouraging patterns from marked attendance — use these to recognize steady
          participation and momentum.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!signals.hasComparisonData ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {signals.emptyMessage}
            </p>
            {signals.emptyHints.length > 0 ? (
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {signals.emptyHints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {signals.strongestClassThisWeek ? (
              <SignalCard
                title="Strongest class this week"
                detail={`${signals.strongestClassThisWeek.classLabel} (${signals.strongestClassThisWeek.gradeName})`}
                metric={`${signals.strongestClassThisWeek.attendancePct}% attended`}
                footnote={`${signals.weekRange.start} – ${signals.weekRange.end} · ${signals.strongestClassThisWeek.schoolDaysMarked} school days marked`}
              />
            ) : null}
            {signals.strongestGradeThisMonth ? (
              <SignalCard
                title="Strongest grade this month"
                detail={signals.strongestGradeThisMonth.gradeName}
                metric={`${signals.strongestGradeThisMonth.attendancePct}% attended`}
                footnote={`${signals.monthRange.start.slice(0, 7)} · ${signals.strongestGradeThisMonth.schoolDaysMarked} school days marked`}
              />
            ) : null}
            {signals.mostImprovedClass ? (
              <SignalCard
                title="Most improved class"
                detail={`${signals.mostImprovedClass.classLabel} (${signals.mostImprovedClass.gradeName})`}
                metric={`+${signals.mostImprovedClass.improvementPp} pts week over week`}
                footnote={`Now ${signals.mostImprovedClass.attendancePct}% (was ${signals.mostImprovedClass.priorAttendancePct}%)`}
              />
            ) : null}
            {signals.recoveringClasses.length > 0 ? (
              <SignalCard
                title="Classes moving in a better direction"
                detail={signals.recoveringClasses
                  .map(
                    (c) =>
                      `${c.classLabel} (${attendanceRiskTierLabels[c.priorTier]} → ${attendanceRiskTierLabels[c.currentTier]})`,
                  )
                  .join(" · ")}
                metric={`${signals.recoveringClasses.length} class${signals.recoveringClasses.length === 1 ? "" : "es"}`}
                footnote="Week-over-week risk tier improved from at-risk or chronic to monitor or on track"
              />
            ) : null}
            {signals.recoveringStudents.length > 0 ? (
              <li className="sm:col-span-2">
                <SignalCard
                  title="Students showing stronger attendance"
                  detail={signals.recoveringStudents
                    .map(
                      (s) =>
                        `${s.studentName} · ${s.classLabel} (${attendanceRiskTierLabels[s.priorTier]} → ${attendanceRiskTierLabels[s.currentTier]})`,
                    )
                    .join(" · ")}
                  metric={`${signals.recoveringStudents.length} student${signals.recoveringStudents.length === 1 ? "" : "s"}`}
                  footnote="Prior week was at-risk or chronic; this week is monitor or on track"
                />
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SignalCard({
  title,
  detail,
  metric,
  footnote,
}: {
  title: string;
  detail: string;
  metric: string;
  footnote: string;
}) {
  return (
    <li className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2.5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{detail}</p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums">{metric}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{footnote}</p>
    </li>
  );
}
