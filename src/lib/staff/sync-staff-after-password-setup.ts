import "server-only";

import { linkStaffMemberToAuthUser } from "@/lib/staff/link-staff-member-to-auth-user";
import {
  syncPendingStaffInvitationProfile,
  touchStaffMemberActivity,
} from "@/lib/staff/sync-staff-invitation-profile";
import { getProfileRole } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * After a recovery/invite session sets a password: accept pending invites,
 * link the existing staff row when unambiguous, preserve role/grades/classes.
 * Does not create Auth users or duplicate staff_members.
 */
export async function syncStaffAccountAfterPasswordSetup(): Promise<void> {
  await syncPendingStaffInvitationProfile();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  await touchStaffMemberActivity(user.id);

  const role = await getProfileRole(user.id);
  if (role) return;
  if (!user.email) return;

  try {
    const admin = createAdminSupabaseClient();
    const email = normalizeEmail(user.email);
    const { data: member } = await admin
      .from("staff_members")
      .select("id, profile_id")
      .eq("email", email)
      .is("archived_at", null)
      .maybeSingle();

    if (!member?.id) return;
    if (member.profile_id && member.profile_id !== user.id) return;

    await linkStaffMemberToAuthUser({
      staffMemberId: member.id,
      authUserId: user.id,
      email,
      actorUserId: user.id,
    });
  } catch {
    // Non-fatal — workspace routing still uses profiles.role when present.
  }
}
