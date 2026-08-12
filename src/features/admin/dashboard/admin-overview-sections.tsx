import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { cn } from "@/lib/utils";

import {
  adminSignalStatusKind,
  type AdminSignalStatus,
} from "./admin-signal-status";

export type OverviewMetricCardModel = {
  id: string;
  title: string;
  href: string;
  primary: string;
  detail: string | null;
  status: AdminSignalStatus;
};

function OverviewMetricCard({ card }: { card: OverviewMetricCardModel }) {
  return (
    <Link
      href={card.href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card variant="interactive" className="h-full min-h-[7.5rem]">
        <CardHeader density="metric" className="pb-1.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-[13px]">{card.title}</CardTitle>
            <StatusBadge
              status={adminSignalStatusKind(card.status)}
              label={card.status}
              className="shrink-0 text-[10px]"
            />
          </div>
        </CardHeader>
        <CardContent density="metric" className="space-y-1">
          <p
            className={cn(
              "text-heading font-semibold tracking-tight tabular-nums",
              card.primary.length > 12 ? "text-base leading-snug" : "text-2xl",
            )}
            aria-label={`${card.title}: ${card.primary}`}
          >
            {card.primary}
          </p>
          {card.detail ? <p className="ns-meta line-clamp-2">{card.detail}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

/** @deprecated Prefer AdminSchoolPulse. */
export function AdminSchoolHealth({
  cards,
  error,
}: {
  cards: OverviewMetricCardModel[];
  error?: string | null;
}) {
  return (
    <section aria-labelledby="admin-school-health-heading" className="space-y-2.5">
      <WorkspaceSectionHeader
        id="admin-school-health-heading"
        title="School Pulse"
      />
      {error ? (
        <p className="ns-muted" role="status">
          Some school status could not be loaded right now.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <OverviewMetricCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function AdminPeopleSection({
  cards,
}: {
  cards: OverviewMetricCardModel[];
}) {
  return (
    <section aria-labelledby="admin-people-heading" className="space-y-2.5">
      <WorkspaceSectionHeader id="admin-people-heading" title="People" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cards.map((card) => (
          <OverviewMetricCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function AdminLearningRecords({
  cards,
}: {
  cards: OverviewMetricCardModel[];
}) {
  return (
    <section
      aria-labelledby="admin-learning-records-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-learning-records-heading"
        title="Learning & Records"
      />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <OverviewMetricCard key={card.id} card={card} />
        ))}
      </div>
      <p className="ns-meta">
        Progress reports — coming in a later release.
      </p>
    </section>
  );
}

export { OverviewMetricCard };
