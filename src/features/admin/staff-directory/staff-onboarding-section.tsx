"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddStaffSheet } from "@/features/admin/staff-directory/add-staff-sheet";
import type {
  ClassInviteOption,
  GradeInviteOption,
} from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type { StaffInvitationRow } from "@/features/admin/staff-directory/staff-invitations-queries";
import { StaffInvitationsTable } from "@/features/admin/staff-directory/staff-invitations-table";

type StaffOnboardingSectionProps = {
  invitations: StaffInvitationRow[];
  invitationsError: string | null;
  gradeOptions: GradeInviteOption[];
  classOptions: ClassInviteOption[];
  loginBaseUrl: string;
};

/**
 * Legacy invitations panel. Prefer the master Staff directory + Send invitations flow.
 * Kept for backward-compatible embeds that still list pending invitation tokens.
 */
export function StaffOnboardingSection({
  invitations,
  invitationsError,
  gradeOptions,
  classOptions,
  loginBaseUrl,
}: StaffOnboardingSectionProps) {
  return (
    <Card>
      <CardHeader
        density="compact"
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="space-y-1">
          <CardTitle>Staff invitations</CardTitle>
          <CardDescription>
            Add staff to the roster first, then send invitations when they should activate.
          </CardDescription>
        </div>
        <AddStaffSheet gradeOptions={gradeOptions} classOptions={classOptions} />
      </CardHeader>
      <CardContent density="compact">
        <StaffInvitationsTable
          rows={invitations}
          error={invitationsError}
          loginBaseUrl={loginBaseUrl}
          gradeOptions={gradeOptions}
          classOptions={classOptions}
        />
      </CardContent>
    </Card>
  );
}
