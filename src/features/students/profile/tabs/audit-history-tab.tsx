import { History, Shield } from "lucide-react";

import type { Role } from "@/config/roles";
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

import { ProfileEmptyState } from "../profile-empty-state";
import { loadAuditEventsForStudent } from "../supabase-profile-data";

const CARD_CHROME = "border-border/70 shadow-sm";
const TH = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

type AuditHistoryTabProps = {
  studentId: string;
  viewerRole: Role;
};

export async function AuditHistoryTab({
  studentId,
  viewerRole,
}: AuditHistoryTabProps) {
  const loaded = await loadAuditEventsForStudent(studentId, viewerRole);

  if (loaded.kind === "forbidden") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Audit history</CardTitle>
          <CardDescription>Restricted to school leadership and administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEmptyState
            icon={Shield}
            title="This tab is restricted"
            description="Your role does not include per-student audit history. Ask an administrator if you need a compliance export."
          />
        </CardContent>
      </Card>
    );
  }

  if (loaded.kind === "error") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Audit history</CardTitle>
          <CardDescription>Events could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm" role="alert">
            {loaded.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const events = loaded.events;

  return (
    <Card className={CARD_CHROME}>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base">Audit history</CardTitle>
        <CardDescription>
          Recent <code className="text-foreground text-xs">audit_events</code> rows whose
          metadata references this student.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <ProfileEmptyState
            icon={History}
            title="No audit events yet"
            description={
              <>
                Profile views, edits, and other recorded actions that reference this
                student will appear here for authorized roles.
              </>
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground sm:hidden text-xs leading-relaxed">
              Swipe horizontally to see all columns.
            </p>
            <Table aria-label="Audit history">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${TH} whitespace-nowrap`}>When</TableHead>
                  <TableHead className={TH}>Actor</TableHead>
                  <TableHead className={`${TH} hidden md:table-cell`}>Action</TableHead>
                  <TableHead className={TH}>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-sm align-top">
                      {new Date(event.occurredAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="align-top text-sm font-medium">
                      {event.actorName}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden align-top font-mono text-xs md:table-cell">
                      {event.action}
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <span className="text-muted-foreground block text-xs">
                        {event.entityType} · {event.entityId}
                      </span>
                      {event.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
