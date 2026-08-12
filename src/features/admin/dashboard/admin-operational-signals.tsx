import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { cn } from "@/lib/utils";

import {
  adminSignalBadgeVariant,
  classesSignalStatus,
  enrollmentSignalStatus,
  queueSignalStatus,
  reportCardSignalStatus,
  type AdminSignalStatus,
} from "./admin-signal-status";
import { ADMIN_SIGNAL_CARD_META } from "./constants";
import type { AdminDashboardStats } from "./load-admin-dashboard-stats";

type SignalCardModel = {
  id: string;
  title: string;
  href: string;
  status: AdminSignalStatus;
  primary: string;
  /** Shown only when it adds decision value beyond title / number / status. */
  detail: string | null;
};

function buildSignalCards(stats: AdminDashboardStats): SignalCardModel[] {
  const [enrollment, classes, transition, reportCards, parentRequests] =
    ADMIN_SIGNAL_CARD_META;

  const enrollmentStatus = enrollmentSignalStatus(stats.activeStudentCount);
  const classesStatus = classesSignalStatus(stats.activeClassCount);
  const transitionStatus = queueSignalStatus(
    stats.pendingTransitionNotesCount,
  );
  const reportStatus = reportCardSignalStatus({
    reportingStarted: stats.reportCardSignal.reportingStarted,
    missingCount: stats.reportCardSignal.missingCount,
    coverageKnown: stats.reportCardSignal.coverageKnown,
  });
  const parentStatus = queueSignalStatus(
    stats.pendingParentRequestsLast30Days,
  );

  const reportPrimary = !stats.reportCardSignal.reportingStarted
    ? "Reporting not started"
    : !stats.reportCardSignal.coverageKnown
      ? "Coverage unknown"
      : stats.reportCardSignal.missingCount === 0
        ? "Complete"
        : `${stats.reportCardSignal.missingCount} missing`;

  const reportDetail = !stats.reportCardSignal.reportingStarted
    ? stats.reportCardSignal.schoolYearLabel
      ? stats.reportCardSignal.schoolYearLabel
      : null
    : !stats.reportCardSignal.coverageKnown
      ? "Could not verify coverage right now."
      : stats.reportCardSignal.missingCount === 0
        ? null
        : `Missing for ${stats.reportCardSignal.completedTermCodes.join(", ")}.`;

  return [
    {
      id: enrollment.id,
      title: enrollment.title,
      href: enrollment.href,
      status: enrollmentStatus,
      primary: String(stats.activeStudentCount),
      detail: stats.activeStudentCount === 0 ? "No active enrollments." : null,
    },
    {
      id: classes.id,
      title: classes.title,
      href: classes.href,
      status: classesStatus,
      primary: String(stats.activeClassCount),
      detail: stats.activeClassCount === 0 ? "No active classes." : null,
    },
    {
      id: transition.id,
      title: transition.title,
      href: transition.href,
      status: transitionStatus,
      primary:
        stats.pendingTransitionNotesCount === 0
          ? "Clear"
          : String(stats.pendingTransitionNotesCount),
      detail:
        stats.pendingTransitionNotesCount === 0
          ? null
          : "Awaiting leadership review.",
    },
    {
      id: reportCards.id,
      title: reportCards.title,
      href: reportCards.href,
      status: reportStatus,
      primary: reportPrimary,
      detail: reportDetail,
    },
    {
      id: parentRequests.id,
      title: parentRequests.title,
      href: parentRequests.href,
      status: parentStatus,
      primary:
        stats.pendingParentRequestsLast30Days === 0
          ? "Clear"
          : String(stats.pendingParentRequestsLast30Days),
      detail:
        stats.pendingParentRequestsLast30Days === 0
          ? null
          : "Open in the last 30 days.",
    },
  ];
}

function SignalCard({ card }: { card: SignalCardModel }) {
  return (
    <Link
      href={card.href}
      className="group block rounded-xl outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card variant="interactive" className="h-full">
        <CardHeader density="metric" className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle>{card.title}</CardTitle>
            <Badge
              variant={adminSignalBadgeVariant(card.status)}
              className="shrink-0 text-[11px] shadow-none"
            >
              {card.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent density="metric" className="space-y-1.5">
          <p
            className={cn(
              "text-heading font-semibold tracking-tight tabular-nums",
              card.primary.length > 4 ? "text-lg" : "text-2xl",
            )}
            aria-label={`${card.title}: ${card.primary}`}
          >
            {card.primary}
          </p>
          {card.detail ? (
            <p className="ns-meta">{card.detail}</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * @deprecated Prefer AdminSchoolPulse via loadAdminCommandCenter.
 */
export function AdminOperationalSignals({
  stats,
}: {
  stats: AdminDashboardStats;
}) {
  const cards = buildSignalCards(stats);

  return (
    <section aria-labelledby="admin-signals-heading" className="space-y-3">
      <WorkspaceSectionHeader
        id="admin-signals-heading"
        eyebrow="Health"
        title="Operational signals"
      />
      {stats.dbError ? (
        <p className="ns-muted" role="status">
          {stats.dbError}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <SignalCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
