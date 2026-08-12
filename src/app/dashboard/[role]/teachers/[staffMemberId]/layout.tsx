import { notFound } from "next/navigation";

import {
  canAccessFollowUp,
  canManageStaffDirectory,
  isRole,
  type Role,
} from "@/config/roles";
import { FollowUpFormSheet } from "@/features/follow-up/follow-up-form-sheet";
import { loadStaffInviteAccessOptions } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import { loadStaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import { StaffProfileActions } from "@/features/staff-profile/staff-profile-actions";
import { StaffProfileHeader } from "@/features/staff-profile/staff-profile-header";
import { StaffProfileNav } from "@/features/staff-profile/staff-profile-nav";
import { StaffProfileTabs } from "@/features/staff-profile/staff-profile-tabs";
import { loadStaffMemberProfile } from "@/features/staff-profile/load-staff-profile";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { isUuid } from "@/lib/students/uuid";
import { getAuthEmailRedirectToLogin } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StaffProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string; staffMemberId: string }>;
}) {
  const { role: roleParam, staffMemberId } = await params;
  if (!isRole(roleParam) || !canManageStaffDirectory(roleParam)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  const role = roleParam as Role;
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) notFound();

  const profileLoad = await loadStaffMemberProfile(staffMemberId);
  if (profileLoad.kind === "not_found") notFound();

  if (profileLoad.kind === "error") {
    return (
      <div className="ns-page-shell-wide space-y-4">
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">Could not load this staff member</p>
          <p className="mt-1 opacity-90">{profileLoad.message}</p>
        </div>
        {children}
      </div>
    );
  }

  const member = profileLoad.member;
  const [metrics, accessOptions] = await Promise.all([
    loadStaffLeadershipMetrics(staffMemberId, member, role),
    loadStaffInviteAccessOptions(),
  ]);

  const loginBaseUrl = getAuthEmailRedirectToLogin();

  void recordAuditEvent({
    action: "staff_profile_viewed",
    metadata: { staffMemberId },
    actorUserId: actor.userId,
  });

  return (
    <div className="ns-page-shell-wide space-y-6">
      <section className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <StaffProfileNav role={role} staffName={member.full_name} />
          <StaffProfileHeader
            member={member}
            grades={metrics.grades}
            classes={metrics.classes}
            metrics={metrics}
            actions={
              <div className="flex w-full flex-col gap-2">
                {canAccessFollowUp(role) ? (
                  <FollowUpFormSheet
                    prefill={{
                      staffMemberId,
                      staffLabel: member.full_name,
                      category: "staff",
                    }}
                    triggerLabel="Add Follow-Up"
                    triggerVariant="outline"
                  />
                ) : null}
                <StaffProfileActions
                  member={member}
                  currentUserId={actor.userId}
                  grades={metrics.grades}
                  classes={metrics.classes}
                  availableGrades={accessOptions.grades}
                  availableClasses={accessOptions.classes}
                  loginBaseUrl={loginBaseUrl}
                />
              </div>
            }
          />
          <div className="border-border/70 border-t pt-5">
            <StaffProfileTabs role={role} staffMemberId={staffMemberId} />
          </div>
        </div>
      </section>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
