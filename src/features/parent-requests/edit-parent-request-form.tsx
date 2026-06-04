"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { Role } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AssignmentProfileRow } from "@/features/parent-requests/load-assignment-profiles";
import type { ParentRequestDetailRow } from "@/features/parent-requests/load-parent-requests";
import {
  updateParentRecordRequestAction,
  type ParentRequestMutationState,
} from "@/features/parent-requests/parent-record-request-actions";

import {
  PARENT_REQUEST_DOCUMENT_TYPES,
  PARENT_REQUEST_STATUSES,
  parentRequestStatusLabel,
} from "./constants";

function documentLabel(id: string): string {
  const row = PARENT_REQUEST_DOCUMENT_TYPES.find((d) => d.id === id);
  return row?.label ?? id;
}

export function EditParentRequestForm({
  dashboardRole,
  row,
  assignees,
  handler,
}: {
  dashboardRole: Role;
  row: ParentRequestDetailRow;
  assignees: AssignmentProfileRow[];
  handler: AssignmentProfileRow | null;
}) {
  const [state, action, pending] = useActionState<
    ParentRequestMutationState | undefined,
    FormData
  >(updateParentRecordRequestAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update request</CardTitle>
        <CardDescription>
          Changes are audited. Setting status to completed records a completion event once per
          transition into completed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Student: </span>
            <Link
              href={`/dashboard/${dashboardRole}/students/${row.student_id}/report-cards`}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {row.student
                ? [
                    row.student.preferred_name?.trim() ||
                      [row.student.first_name, row.student.last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim(),
                    row.student.external_id?.trim()
                      ? ` · #${row.student.external_id.trim()}`
                      : "",
                  ].join("")
                : row.student_id.slice(0, 8) + "…"}
            </Link>
          </p>
          <p>
            <span className="text-muted-foreground">Requester: </span>
            <span className="text-foreground font-medium">{row.requester_name}</span>
            <span className="text-muted-foreground"> · </span>
            {row.requester_email}
          </p>
          <p>
            <span className="text-muted-foreground">Relationship: </span>
            {row.requester_relationship || "—"}
          </p>
          <div className="space-y-1">
            <p className="text-muted-foreground">Requested documents</p>
            <div className="flex flex-wrap gap-1.5">
              {row.requested_documents.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                row.requested_documents.map((id) => (
                  <Badge key={id} variant="secondary">
                    {documentLabel(id)}
                  </Badge>
                ))
              )}
            </div>
          </div>
          {handler ? (
            <p>
              <span className="text-muted-foreground">Currently assigned: </span>
              {(handler.full_name?.trim() || handler.email?.trim() || handler.id).slice(
                0,
                120,
              )}
            </p>
          ) : null}
        </section>

        <form action={action} className="space-y-5">
          <input type="hidden" name="dashboardRole" value={dashboardRole} />
          <input type="hidden" name="request_id" value={row.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                name="status"
                defaultValue={row.status}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {PARENT_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {parentRequestStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignee">Assigned handler</Label>
              <select
                id="edit-assignee"
                name="assigned_to_profile_id"
                defaultValue={row.assigned_to_profile_id ?? ""}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">— Unassigned —</option>
                {assignees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name?.trim() || p.email?.trim() || p.id).slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-details">Reason / notes (family-facing)</Label>
            <textarea
              id="edit-details"
              name="details"
              rows={4}
              defaultValue={row.details ?? ""}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex min-h-[96px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-staff-notes">Staff notes (internal)</Label>
            <textarea
              id="edit-staff-notes"
              name="staff_notes"
              rows={3}
              defaultValue={row.staff_notes ?? ""}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </div>

          {state && !state.ok ? (
            <p className="text-destructive text-sm" role="alert">
              {state.message}
            </p>
          ) : null}
          {state?.ok ? (
            <p className="text-primary text-sm" role="status">
              {state.message ?? "Saved."}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
