"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteStaffSheet } from "@/features/admin/staff-directory/invite-staff-sheet";
import type { ClassInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import type { StaffInvitationRow } from "@/features/admin/staff-directory/staff-invitations-queries";
import { StaffInvitationsTable } from "@/features/admin/staff-directory/staff-invitations-table";

type StaffOnboardingSectionProps = {
  invitations: StaffInvitationRow[];
  invitationsError: string | null;
  classOptions: ClassInviteOption[];
  loginBaseUrl: string;
};

export function StaffOnboardingSection({
  invitations,
  invitationsError,
  classOptions,
  loginBaseUrl,
}: StaffOnboardingSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Staff onboarding</CardTitle>
          <CardDescription>
            Invite colleagues, copy sign-in links, and track pending access. When someone signs in
            with the invited email, their profile and role update automatically. Optional class
            picks apply for teachers on first login.
          </CardDescription>
        </div>
        <InviteStaffSheet classOptions={classOptions} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm leading-relaxed">
          <p className="text-foreground font-medium">If email delivery fails</p>
          <p className="mt-1">
            The invitation is still saved. Use <strong>Copy recovery link</strong> on the row, or
            the links shown after you submit the invite form. The invitee should use the same work
            email when they sign in so their access syncs.
          </p>
        </div>
        <StaffInvitationsTable
          rows={invitations}
          error={invitationsError}
          loginBaseUrl={loginBaseUrl}
        />
      </CardContent>
    </Card>
  );
}
