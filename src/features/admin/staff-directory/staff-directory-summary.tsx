import type { StaffDirectorySummary } from "@/features/admin/staff-directory/staff-directory-queries";

type StaffDirectorySummaryStripProps = {
  summary: StaffDirectorySummary;
};

const METRICS: {
  key: keyof Omit<StaffDirectorySummary, "error">;
  label: string;
}[] = [
  { key: "activeStaff", label: "Active" },
  { key: "teachers", label: "Teachers" },
  { key: "readyToInvite", label: "Ready to invite" },
  { key: "pendingInvitations", label: "Invitations sent" },
];

/** Compact inline metrics — consumes shared `ns-meta` / muted tokens. */
export function StaffDirectorySummaryStrip({ summary }: StaffDirectorySummaryStripProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        {METRICS.map((metric) => (
          <span key={metric.key} className="inline-flex items-baseline gap-1.5">
            <span className="text-foreground text-sm font-semibold tabular-nums leading-none">
              {summary[metric.key]}
            </span>
            <span className="ns-meta">{metric.label}</span>
          </span>
        ))}
      </div>
      {summary.error ? (
        <p className="ns-meta" role="status">
          Some summary counts could not be loaded.
        </p>
      ) : null}
    </div>
  );
}
