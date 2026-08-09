import Link from "next/link";
import { MessageSquarePlus, MessagesSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  canManageParentRecordRequests,
  type Role,
} from "@/config/roles";
import {
  loadStudentBehaviorProfile,
  type StudentBehaviorRecord,
} from "@/features/attendance-behavior/load-student-behavior-profile";
import { loadParentRequestsForStudent } from "@/features/parent-requests/load-parent-requests";
import { ParentRequestStatusBadge } from "@/features/parent-requests/parent-request-status-badge";
import { supportMomentCategoryLabels } from "@/lib/student-support/quick-reasons";

import { ProfileEmptyState } from "../profile-empty-state";

const CARD_CHROME = "border-border/70 shadow-sm";
const TH = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

function isParentMoment(row: StudentBehaviorRecord): boolean {
  return (
    row.supportCategory === "parent_communication" ||
    row.behaviorType === "parent_contact"
  );
}

type ParentCommunicationTabProps = {
  studentId: string;
  role: Role;
};

export async function ParentCommunicationTab({
  studentId,
  role,
}: ParentCommunicationTabProps) {
  const base = `/dashboard/${role}/students/${studentId}`;
  const behaviorLoad = await loadStudentBehaviorProfile(studentId, role);
  const parentMoments =
    behaviorLoad.ok === true
      ? behaviorLoad.recent.filter(isParentMoment).slice(0, 25)
      : [];

  const formalRequests = canManageParentRecordRequests(role)
    ? await loadParentRequestsForStudent(studentId)
    : { ok: true as const, rows: [] };

  const newRequestHref = `/dashboard/${role}/parent-requests/new?studentId=${encodeURIComponent(studentId)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Parent communication</h2>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Formal record requests from families and classroom-documented caregiver
            touchpoints for this student.
          </p>
        </div>
        {canManageParentRecordRequests(role) ? (
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href={newRequestHref}>
              <MessageSquarePlus className="size-4" aria-hidden />
              New parent request
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className={CARD_CHROME}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Parent record requests</CardTitle>
            <CardDescription>
              Official document requests tracked for compliance and fulfillment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canManageParentRecordRequests(role) ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Parent record requests are visible to registrars and school leadership.
                Ask the office if you need a packet generated for this family.
              </p>
            ) : formalRequests.ok !== true ? (
              <p className="text-destructive text-sm" role="alert">
                {formalRequests.message}
              </p>
            ) : formalRequests.rows.length === 0 ? (
              <div className="space-y-3">
                <ProfileEmptyState
                  icon={MessagesSquare}
                  title="No formal requests yet"
                  description="When a caregiver submits a record request for this student, it appears here with status and document checklist."
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={newRequestHref}>Create request</Link>
                </Button>
              </div>
            ) : (
              <Table aria-label="Parent record requests for this student">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TH}>Requested</TableHead>
                    <TableHead className={TH}>Requester</TableHead>
                    <TableHead className={TH}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formalRequests.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {row.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-sm">
                        <Link
                          href={`/dashboard/${role}/parent-requests/${row.id}`}
                          className="text-primary font-medium underline-offset-4 hover:underline"
                        >
                          {row.requester_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ParentRequestStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Classroom log</CardTitle>
              <CardDescription>
                Support moments tagged as parent or caregiver communication.
              </CardDescription>
            </div>
            <Link
              href={`${base}/behavior`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              Full behavior tab
            </Link>
          </CardHeader>
          <CardContent>
            {behaviorLoad.ok !== true ? (
              <ProfileEmptyState
                icon={MessagesSquare}
                title="No class context"
                description={behaviorLoad.message}
              />
            ) : parentMoments.length === 0 ? (
              <ProfileEmptyState
                icon={MessagesSquare}
                title="No logged caregiver touchpoints"
                description="When teachers document parent communication in the support board, those entries surface here."
              />
            ) : (
              <ul className="space-y-3">
                {parentMoments.map((row) => (
                  <li
                    key={row.id}
                    className="border-border/60 space-y-1 rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {row.behaviorDate}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {row.supportCategory
                          ? supportMomentCategoryLabels[row.supportCategory]
                          : "Parent contact"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      {row.generatedSummary?.trim() || row.title}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
