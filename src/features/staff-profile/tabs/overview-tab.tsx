import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";

import { isRole, roleLabels } from "@/config/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStaffAssignedClassesSummary } from "@/features/admin/staff-directory/format-assigned-classes-summary";
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import type { StaffMemberRow } from "@/features/admin/staff-directory/staff-directory-queries";
import type { StaffActivityItem } from "@/features/staff-profile/load-staff-activity";
import type { StaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import { formatAttendanceTodaySummary } from "@/features/staff-profile/operations-summary";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";
import {
  staffRosterStatusKind,
  staffRosterStatusLabel,
} from "@/lib/staff/staff-roster-status";
import type { LucideIcon } from "lucide-react";
import { canAccessFollowUp, isRole as isAppRole } from "@/config/roles";
import { OpenFollowUpsCard } from "@/features/follow-up/open-follow-ups-card";
import type { FollowUpItem } from "@/features/follow-up/types";

type OverviewTabProps = {
  member: StaffMemberRow;
  metrics: StaffLeadershipMetrics;
  recentActivity: StaffActivityItem[];
  viewerRole: string;
  openFollowUps?: FollowUpItem[];
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function reportCardSummary(metrics: StaffLeadershipMetrics): string {
  const rc = metrics.reportCards;
  if (!rc.available || !rc.coverageKnown) {
    return "Not available";
  }
  if (!rc.reportingStarted) {
    return "Reporting cycle not started";
  }
  if (rc.totalStudents === 0) {
    return "No enrolled students";
  }
  if (rc.remainingCount === 0) {
    return `${rc.completeCount} / ${rc.completeCount} complete`;
  }
  return `${rc.completeCount} complete · ${rc.remainingCount} remaining`;
}

function transitionSummary(metrics: StaffLeadershipMetrics): string {
  const total = metrics.transitionNotes.length;
  if (total === 0) return "None yet";
  const parts: string[] = [];
  if (metrics.transitionCompleted > 0) {
    parts.push(`${metrics.transitionCompleted} reviewed`);
  }
  if (metrics.transitionPendingReview > 0) {
    parts.push(`${metrics.transitionPendingReview} awaiting review`);
  }
  const drafts = total - metrics.transitionCompleted - metrics.transitionPendingReview;
  if (drafts > 0) parts.push(`${drafts} in progress`);
  return parts.join(" · ") || `${total} note${total === 1 ? "" : "s"}`;
}

export function StaffOverviewTab({
  member,
  metrics,
  recentActivity,
  viewerRole,
  openFollowUps = [],
}: OverviewTabProps) {
  const roleLabel = isRole(member.role) ? roleLabels[member.role] : member.role;
  const isTeacher = member.role === "teacher";
  const homeroom = metrics.classes.find((c) => c.assignmentRole === "homeroom");

  return (
    <div className="space-y-8">
      {isAppRole(viewerRole) && canAccessFollowUp(viewerRole) ? (
        <OpenFollowUpsCard
          role={viewerRole}
          items={openFollowUps}
          prefill={{
            staffMemberId: member.id,
            staffLabel: member.full_name,
            category: "staff",
          }}
        />
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card variant="metric">
          <CardHeader className="pb-2">
            <CardDescription>Attendance</CardDescription>
            <CardTitle className="text-base leading-snug sm:text-lg">
              <span className="text-muted-foreground block text-sm font-normal">
                Today&apos;s Classes
              </span>
              <span className="mt-1 block">
                {formatAttendanceTodaySummary(metrics.attendanceCompliance)}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card variant="metric">
          <CardHeader className="pb-2">
            <CardDescription>Teaching assignment</CardDescription>
            <CardTitle className="text-base leading-snug sm:text-lg">
              {isTeacher ? (
                <>
                  <span className="block">
                    {formatStaffAssignedGradesSummary(metrics.grades)}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm font-normal">
                    {metrics.classes.length === 0
                      ? "No classes assigned"
                      : `${metrics.classes.length} class${metrics.classes.length === 1 ? "" : "es"}`}
                    {homeroom
                      ? ` · Homeroom: ${homeroom.className}`
                      : null}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground text-sm font-normal">
                  Not a teaching role
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card variant="metric">
          <CardHeader className="pb-2">
            <CardDescription>Student records</CardDescription>
            <CardTitle className="text-base leading-snug sm:text-lg">
              <span className="block text-sm font-medium">
                Transition notes: {transitionSummary(metrics)}
              </span>
              <span className="text-muted-foreground mt-1 block text-sm font-normal">
                Report cards: {reportCardSummary(metrics)}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card variant="metric">
          <CardHeader className="pb-2">
            <CardDescription>Professional</CardDescription>
            <CardTitle className="text-base leading-snug sm:text-lg">
              <span className="text-muted-foreground text-sm font-normal">
                No observations or feedback recorded yet
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="ns-section-title">Needs attention</h2>
        {metrics.attentionItems.length === 0 ? (
          <div
            role="status"
            className="text-muted-foreground flex items-center gap-2.5 py-1"
          >
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <p className="ns-body">No current follow-up</p>
          </div>
        ) : (
          <Card variant="table">
            <ul className="divide-border divide-y">
              {metrics.attentionItems.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="hover:bg-row-hover text-heading block px-4 py-3 text-sm font-medium ns-transition"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <p className="text-heading px-4 py-3 text-sm font-medium">
                      {item.label}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Information</CardTitle>
            <CardDescription>Roster identity for leadership review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Full name" value={member.full_name} />
            <InfoRow label="Email" value={member.email?.trim() || "Not added"} />
            <InfoRow label="Role" value={roleLabel} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge
                status={staffRosterStatusKind(member.displayStatus)}
                label={staffRosterStatusLabel(member.displayStatus)}
              />
            </div>
            {isTeacher ? (
              <>
                <InfoRow
                  label="Grade / program"
                  value={formatStaffAssignedGradesSummary(metrics.grades)}
                />
                <InfoRow
                  label="Classes"
                  value={formatStaffAssignedClassesSummary(metrics.classes)}
                />
              </>
            ) : null}
            <InfoRow
              label="Account"
              value={member.profile_id ? "Activated" : "Not linked yet"}
            />
            <InfoRow
              label="Invite"
              value={member.inviteStatus ?? "—"}
            />
            <InfoRow
              label="Created"
              value={formatDate(member.created_at)}
            />
            {member.notes?.trim() ? (
              <div className="border-border/60 space-y-1 border-t pt-3">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Notes
                </p>
                <p className="text-foreground whitespace-pre-wrap">{member.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Recent activity</CardTitle>
            <CardDescription>
              Real audit events for this staff member.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="px-6 pb-6">
                <ProfileEmptyState
                  icon={ClipboardList}
                  title="No recent activity"
                  description="Leadership actions for this person will appear here when recorded."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {recentActivity.slice(0, 6).map((item) => (
                  <li key={item.id} className="px-6 py-3">
                    <p className="text-heading text-sm font-medium">{item.summary}</p>
                    <p className="ns-meta mt-0.5">
                      {formatWhen(item.occurredAt)}
                      {item.actorLabel ? ` · ${item.actorLabel}` : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {recentActivity.length > 0 ? (
              <div className="border-border/60 border-t px-6 py-3">
                <Link
                  href={`/dashboard/${viewerRole}/teachers/${member.id}/files-activity`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View all activity
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

export function StaffFutureStateTab({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <ProfileEmptyState icon={Icon} title={title} description={description} />
  );
}
