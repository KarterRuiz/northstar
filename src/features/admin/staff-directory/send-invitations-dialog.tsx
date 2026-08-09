"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { isRole, roleLabels, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GradeInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
  StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  sendStaffInvitationsAction,
  type SendStaffInvitationsState,
} from "@/features/admin/staff-directory/send-staff-invitations-actions";
import { formatStaffAssignedClassesSummary } from "@/features/admin/staff-directory/format-assigned-classes-summary";
import { formatStaffAssignedGradesSummary } from "@/features/admin/staff-directory/format-assigned-grades-summary";
import {
  canSendStaffInvitation,
  staffInvitationIneligibilityReason,
  staffRosterStatusKind,
  staffRosterStatusLabel,
} from "@/lib/staff/staff-roster-status";

type SendInvitationsDialogProps = {
  candidates: StaffMemberRow[];
  gradesByMember: Map<string, StaffGradeAccessRow[]>;
  classesByMember: Map<string, StaffClassAssignmentRow[]>;
  gradeOptions: GradeInviteOption[];
};

type SelectMode = "manual" | "all_ready" | "by_role" | "by_grade";

export function SendInvitationsDialog({
  candidates,
  gradesByMember,
  classesByMember,
  gradeOptions,
}: SendInvitationsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SelectMode>("manual");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [gradeFilter, setGradeFilter] = useState("");

  const [state, formAction, pending] = useActionState<
    SendStaffInvitationsState | undefined,
    FormData
  >(sendStaffInvitationsAction, undefined);

  const withEligibility = useMemo(
    () =>
      candidates.map((c) => {
        const latestInvite =
          c.inviteStatus != null
            ? {
                status: c.inviteStatus,
                expires_at: null as string | null,
              }
            : null;
        const eligible = canSendStaffInvitation({
          membershipStatus: c.status,
          archivedAt: c.archived_at,
          profileId: c.profile_id,
          email: c.email,
          latestInvite:
            c.displayStatus === "invitation_sent" || c.displayStatus === "opened"
              ? { status: "pending", expires_at: null }
              : null,
        });
        const reason = eligible
          ? null
          : staffInvitationIneligibilityReason({
              membershipStatus: c.status,
              archivedAt: c.archived_at,
              profileId: c.profile_id,
              email: c.email,
              latestInvite:
                c.displayStatus === "invitation_sent" || c.displayStatus === "opened"
                  ? { status: "pending", expires_at: null }
                  : latestInvite,
            });
        return { row: c, eligible, reason };
      }),
    [candidates],
  );

  const invitable = useMemo(
    () => withEligibility.filter((c) => c.eligible).map((c) => c.row),
    [withEligibility],
  );

  const selected = useMemo(() => {
    if (mode === "all_ready") {
      return new Set(invitable.map((c) => c.id));
    }
    if (mode === "by_role" && roleFilter) {
      return new Set(invitable.filter((c) => c.role === roleFilter).map((c) => c.id));
    }
    if (mode === "by_grade" && gradeFilter) {
      return new Set(
        invitable
          .filter((c) =>
            (gradesByMember.get(c.id) ?? []).some((g) => g.gradeLevelId === gradeFilter),
          )
          .map((c) => c.id),
      );
    }
    return new Set([...manualSelected].filter((id) => invitable.some((c) => c.id === id)));
  }, [mode, roleFilter, gradeFilter, invitable, gradesByMember, manualSelected]);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  function toggle(id: string) {
    setMode("manual");
    setManualSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setManualSelected(new Set());
          setMode("manual");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Mail className="h-4 w-4" aria-hidden />
          Send invitations
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Send invitations</DialogTitle>
          <DialogDescription>
            Activate selected roster members. They confirm their name, set a password, and sign in —
            grade and class access is already assigned. Staff without an email cannot be invited.
          </DialogDescription>
        </DialogHeader>

        {state?.ok ? (
          <div className="space-y-3 overflow-y-auto">
            <p className="text-primary text-sm font-medium" role="status">
              {state.message}
            </p>
            <ul className="space-y-2">
              {state.results.map((r) => (
                <li
                  key={r.staffMemberId}
                  className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <code className="bg-muted max-w-full flex-1 truncate rounded px-2 py-1 text-xs">
                    {r.inviteUrl}
                  </code>
                  <CopyTextButton text={r.inviteUrl} label="Copy link" size="sm" />
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.refresh();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-select-mode">Selection</Label>
                <select
                  id="invite-select-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as SelectMode)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="manual">Select individually</option>
                  <option value="all_ready">All not yet invited (eligible)</option>
                  <option value="by_role">By role (eligible only)</option>
                  <option value="by_grade">By grade / program (eligible only)</option>
                </select>
              </div>
              {mode === "by_role" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role-filter">Role</Label>
                  <select
                    id="invite-role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter((e.target.value as Role) || "")}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  >
                    <option value="">Choose role…</option>
                    {(Object.keys(roleLabels) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {roleLabels[r]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {mode === "by_grade" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="invite-grade-filter">Grade / program</Label>
                  <select
                    id="invite-grade-filter"
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  >
                    <option value="">Choose grade…</option>
                    {gradeOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              {withEligibility.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No staff are ready to invite. Add staff to the directory first.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Grades</TableHead>
                      <TableHead>Classes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withEligibility.map(({ row, eligible, reason }) => {
                      const grades = gradesByMember.get(row.id) ?? [];
                      const classes = classesByMember.get(row.id) ?? [];
                      const checked = selected.has(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          className={eligible ? "hover:bg-row-hover" : "opacity-70"}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!eligible}
                              onChange={() => toggle(row.id)}
                              aria-label={`Select ${row.full_name}`}
                              title={reason ?? undefined}
                            />
                          </TableCell>
                          <TableCell className="ns-table-primary text-sm">{row.full_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.email?.trim() ? (
                              row.email
                            ) : (
                              <span className="text-amber-800 dark:text-amber-200">Not added</span>
                            )}
                            {!eligible && reason ? (
                              <span className="mt-0.5 block text-xs">{reason}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isRole(row.role) ? roleLabels[row.role] : row.role}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.role === "teacher"
                              ? formatStaffAssignedGradesSummary(grades)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.role === "teacher"
                              ? formatStaffAssignedClassesSummary(classes)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={staffRosterStatusKind(row.displayStatus)}
                              label={staffRosterStatusLabel(row.displayStatus)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {[...selected].map((id) => (
              <input key={`hidden-${id}`} type="hidden" name="staffMemberIds" value={id} />
            ))}

            {state && !state.ok ? (
              <p className="text-destructive text-sm" role="alert">
                {state.message}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || selected.size === 0}>
                {pending
                  ? "Sending…"
                  : `Send ${selected.size || ""} invitation${selected.size === 1 ? "" : "s"}`.trim()}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
