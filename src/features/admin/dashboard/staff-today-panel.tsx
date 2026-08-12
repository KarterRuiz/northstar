import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import {
  isLeadershipAuditRole,
  isRole,
  roleLabels,
  type Role,
} from "@/config/roles";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import {
  staffDirectoryPath,
  staffProfilePath,
} from "@/features/admin/staff-directory/staff-directory-path";
import { staffAttendanceStatusLabel } from "@/features/staff-profile/staff-attendance-labels";
import { loadStaffTodaySummary } from "@/features/staff-profile/load-staff-today";

type StaffTodayPanelProps = {
  role: Role;
};

/**
 * @deprecated Do not mount on Admin Overview.
 * Teacher personal Present/Absent/Late is out of scope for Overview —
 * use class attendance compliance signals instead.
 */
export async function StaffTodayPanel({ role }: StaffTodayPanelProps) {
  if (!isLeadershipAuditRole(role)) return null;

  const summary = await loadStaffTodaySummary();

  return (
    <section aria-labelledby="staff-today-heading" className="space-y-3">
      <WorkspaceSectionHeader
        id="staff-today-heading"
        eyebrow="Staff"
        title="Staff today"
      />

      {summary.error ? (
        <p className="ns-muted" role="status">
          Staff presence is temporarily unavailable.
        </p>
      ) : null}

      {summary.migrationPending ? (
        <p className="ns-muted" role="status">
          Staff attendance is ready in the app. Apply the staff_attendance migration to
          start recording presence.
        </p>
      ) : null}

      {summary.expectedCount === 0 ? (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2.5 py-1"
        >
          <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
          <p className="ns-body">No active staff on the roster yet.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Expected" value={summary.expectedCount} />
            <Metric label="Present" value={summary.present} />
            <Metric label="Absent / late" value={summary.absent + summary.late} />
            <Metric label="Not recorded" value={summary.notRecorded} />
          </div>

          {summary.exceptions.length === 0 ? (
            <div
              role="status"
              className="text-muted-foreground flex items-center gap-2.5 py-1"
            >
              <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
              <p className="ns-body">
                {summary.notRecorded === summary.expectedCount
                  ? "No absences or late marks recorded yet today."
                  : "No absences or late arrivals to review."}
              </p>
            </div>
          ) : (
            <Card variant="table">
              <ul className="divide-border divide-y">
                {summary.exceptions.map((item) => {
                  const roleLabel = isRole(item.role)
                    ? roleLabels[item.role]
                    : item.role;
                  return (
                    <li key={item.staffMemberId}>
                      <Link
                        href={staffProfilePath(role, item.staffMemberId, "attendance")}
                        className="hover:bg-row-hover group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="text-heading block text-sm font-medium">
                            {item.fullName}
                          </span>
                          <span className="ns-meta mt-0.5 flex flex-wrap items-center gap-2">
                            <span>{roleLabel}</span>
                            <StatusBadge
                              status={
                                item.status === "absent" ? "needs_attention" : "pending"
                              }
                              label={staffAttendanceStatusLabel(item.status)}
                            />
                          </span>
                        </span>
                        <ChevronRight
                          className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {summary.notRecorded > 0 ? (
            <p className="ns-meta">
              {summary.notRecorded} not recorded.{" "}
              <Link
                href={staffDirectoryPath(role)}
                className="text-foreground underline-offset-2 hover:underline"
              >
                Open staff directory
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="metric" className="px-4 py-3">
      <p className="ns-meta">{label}</p>
      <p className="text-heading mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
