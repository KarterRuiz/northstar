import Link from "next/link";
import { Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";
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
import { ParentRequestStatusBadge } from "@/features/parent-requests/parent-request-status-badge";

import type { AdminRecentParentRequest } from "./load-admin-dashboard-stats";

const linkClass =
  "text-primary text-sm font-medium underline-offset-4 transition-colors duration-150 hover:underline";

function formatSubmitted(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Recent parent-request strip for Admin Overview.
 * Uses shared Table + ParentRequestStatusBadge.
 */
export function AdminRecentParentRequests({
  requests,
}: {
  requests: AdminRecentParentRequest[];
}) {
  return (
    <section
      className="space-y-3"
      aria-labelledby="admin-recent-requests-heading"
    >
      <WorkspaceSectionHeader
        id="admin-recent-requests-heading"
        eyebrow="Inbox"
        title="Recent parent requests"
        actions={
          <Link href="/dashboard/admin/parent-requests" className={linkClass}>
            Open parent requests
          </Link>
        }
      />
      {requests.length === 0 ? (
        <ListEmptyState
          icon={Inbox}
          title="No requests yet"
          description="Family record requests will appear here for review."
          className="py-8 sm:py-9"
        />
      ) : (
        <Card variant="table">
          <Table aria-label="Recent parent record requests">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[8rem]">Requester</TableHead>
                <TableHead className="min-w-[10rem]">Email</TableHead>
                <TableHead className="w-[7rem]">Status</TableHead>
                <TableHead className="min-w-[6rem] text-right">
                  Submitted
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.requester_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[14rem] truncate text-sm">
                    <span title={r.requester_email}>{r.requester_email}</span>
                  </TableCell>
                  <TableCell>
                    <ParentRequestStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="ns-meta text-right">
                    <time
                      dateTime={r.created_at}
                      title={new Date(r.created_at).toLocaleString()}
                    >
                      {formatSubmitted(r.created_at)}
                    </time>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  );
}
