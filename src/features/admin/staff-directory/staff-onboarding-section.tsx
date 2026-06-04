"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteStaffSheet } from "@/features/admin/staff-directory/invite-staff-sheet";
import type { StaffInvitationRow } from "@/features/admin/staff-directory/staff-invitations-queries";
import { StaffInvitationsTable } from "@/features/admin/staff-directory/staff-invitations-table";

type StaffOnboardingSectionProps = {
  invitations: StaffInvitationRow[];
  invitationsError: string | null;
};

export function StaffOnboardingSection({
  invitations,
  invitationsError,
}: StaffOnboardingSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Staff onboarding</CardTitle>
          <CardDescription>
            Track who should get dashboard access before their Supabase Auth user exists. After you
            create the user in the Supabase Dashboard, paste their User UUID below to attach the
            invitation role to <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">profiles</code>.
          </CardDescription>
        </div>
        <InviteStaffSheet />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm leading-relaxed">
          <p className="text-foreground font-medium">Fully automatic email invites</p>
          <p className="mt-1">
            Sending sign-up links, provisioning Auth users, or syncing directory email without manual
            steps requires a secure server environment with the Supabase{" "}
            <code className="text-foreground rounded bg-background px-1 py-0.5 text-xs">
              service_role
            </code>{" "}
            key or the Auth Admin API. Those credentials must never ship to the browser — this MVP
            intentionally avoids that and keeps all mutations behind signed-in admin server actions
            using the normal user session.
          </p>
        </div>
        <StaffInvitationsTable rows={invitations} error={invitationsError} />
      </CardContent>
    </Card>
  );
}
