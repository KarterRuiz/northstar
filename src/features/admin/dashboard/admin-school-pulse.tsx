import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import {
  adminSignalStatusKind,
  type AdminSignalStatus,
} from "./admin-signal-status";
import type { AdminPulseIndicator } from "./load-admin-command-center";

/**
 * Compact school pulse — a status bar, not an analytics grid.
 */
export function AdminSchoolPulse({
  indicators,
  error,
}: {
  indicators: AdminPulseIndicator[];
  error?: string | null;
}) {
  return (
    <section
      aria-labelledby="admin-school-pulse-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-school-pulse-heading"
        title="School Pulse"
      />

      {error ? (
        <p className="ns-muted" role="status">
          Some school status could not be loaded right now.
        </p>
      ) : null}

      <div className="border-border bg-card divide-border grid grid-cols-2 divide-y rounded-xl border shadow-sm sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x">
        {indicators.map((item) => (
          <PulseCell key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function PulseCell({ item }: { item: AdminPulseIndicator }) {
  return (
    <Link
      href={item.href}
      className="hover:bg-row-hover focus-visible:ring-ring flex min-w-0 flex-col gap-1 px-3 py-2.5 transition-colors duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none sm:px-3.5"
    >
      <span className="ns-meta truncate">{item.label}</span>
      <span className="flex items-center justify-between gap-2">
        <span
          className="text-heading truncate text-sm font-semibold tabular-nums"
          aria-label={`${item.label}: ${item.value}`}
        >
          {item.value}
        </span>
        <StatusBadge
          status={adminSignalStatusKind(item.status)}
          label={pulseBadgeLabel(item.status)}
          className="shrink-0 text-[10px]"
        />
      </span>
    </Link>
  );
}

/** Prefer short pulse labels over full operational phrasing. */
function pulseBadgeLabel(status: AdminSignalStatus): string {
  switch (status) {
    case "Needs attention":
      return "Review";
    case "Action needed":
      return "Follow up";
    case "Not started":
      return "Soon";
    default:
      return status;
  }
}
