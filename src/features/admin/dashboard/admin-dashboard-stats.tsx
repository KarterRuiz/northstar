import Link from "next/link";
import { Inbox } from "lucide-react";

import { siteConfig } from "@/config/site";
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
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { AdminAttendanceOverview } from "./admin-attendance-overview";
import { ADMIN_SUMMARY_CARD_META } from "./constants";
import { getAdminDashboardStats } from "./load-admin-dashboard-stats";

function MetricValue({
  value,
  emptyLabel,
}: {
  value: number;
  emptyLabel: string;
}) {
  if (value === 0) {
    return (
      <p className="text-muted-foreground text-lg font-medium tabular-nums">
        0
        <span className="sr-only"> — {emptyLabel}</span>
      </p>
    );
  }
  return (
    <p
      className="text-3xl font-semibold tabular-nums tracking-tight"
      aria-label={`${value}`}
    >
      {value}
    </p>
  );
}

const linkClass =
  "text-primary text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline";

export async function AdminDashboardStats() {
  const stats = await getAdminDashboardStats();

  const cards = [
    {
      meta: ADMIN_SUMMARY_CARD_META[0],
      value: stats.activeStudentCount,
      emptyLabel: "No active enrollments",
    },
    {
      meta: ADMIN_SUMMARY_CARD_META[1],
      value: stats.activeClassCount,
      emptyLabel: "No active classes",
    },
    {
      meta: ADMIN_SUMMARY_CARD_META[2],
      value: stats.pendingTransitionNotesCount,
      emptyLabel: "Nothing awaiting review",
    },
    {
      meta: ADMIN_SUMMARY_CARD_META[3],
      value: stats.missingReportCardsCount,
      emptyLabel: "No gaps for current year",
    },
    {
      meta: ADMIN_SUMMARY_CARD_META[4],
      value: stats.pendingParentRequestsLast30Days,
      emptyLabel: "No received-status requests (30d)",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section aria-labelledby="admin-summary-heading">
        <WorkspaceSectionHeader
          id="admin-summary-heading"
          eyebrow="Overview"
          title="Operational summary"
          description="Enrollment, classes, and compliance signals at a glance."
          className="mb-4"
        />
        {stats.dbError ? (
          <div
            className="bg-muted/50 text-muted-foreground mb-4 rounded-lg border px-4 py-3 text-sm transition-colors duration-150"
            role="status"
          >
            <span className="text-foreground font-medium">
              Metrics partially unavailable.
            </span>{" "}
            {stats.dbError} Values below may show zero.
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.meta.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  {card.meta.title}
                </CardTitle>
                <CardDescription>{card.meta.caption}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricValue value={card.value} emptyLabel={card.emptyLabel} />
                {card.value === 0 ? (
                  <p className="text-muted-foreground text-xs">{card.emptyLabel}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <AdminAttendanceOverview />

      <section className="border-border bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <WorkspaceSectionHeader
          id="admin-recent-requests-heading"
          eyebrow="Inbox"
          title="Recent parent record requests"
          description="Latest five submissions (any status), newest first."
          actions={
            <Link href="/dashboard/admin/parent-requests" className={linkClass}>
              Open parent requests
            </Link>
          }
          className="mb-4"
        />
        {stats.recentParentRequests.length === 0 ? (
          <ListEmptyState
            icon={Inbox}
            title="No requests in the queue yet"
            description={
              <>
                When families submit record requests, they will land here for
                registrar review. Rows read from{" "}
                <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
                  parent_record_requests
                </code>
                .
              </>
            }
          />
        ) : (
          <Table aria-label="Recent parent record requests">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[8rem]">Requester</TableHead>
                <TableHead className="min-w-[10rem]">Email</TableHead>
                <TableHead className="w-[7rem]">Status</TableHead>
                <TableHead className="min-w-[9rem] text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentParentRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.requester_name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[14rem] truncate text-sm">
                    <span title={r.requester_email}>{r.requester_email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="bg-secondary text-secondary-foreground inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize">
                      {r.status.split("_").join(" ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                    <time dateTime={r.created_at}>
                      {new Date(r.created_at).toLocaleString()}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Live counts from Supabase (RLS applies). Missing report cards compare active
        enrollments to{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5">
          report_card_files
        </code>{" "}
        for the latest school year label in{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5">
          school_years
        </code>
        . {siteConfig.shortName}
      </p>
    </div>
  );
}
