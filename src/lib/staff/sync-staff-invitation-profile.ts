import "server-only";

import { cache } from "react";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * When a signed-in user's email matches a pending `staff_invitations` row, upserts `profiles.role`
 * from the invite and marks the invitation accepted. Idempotent: repeats are no-ops once the
 * invite is no longer pending. Uses the service role for `profiles` / `staff_invitations` writes
 * because RLS restricts those tables to admins; the caller's identity is taken from the session
 * via `auth.getUser()` only.
 *
 * Deduped per request with `cache()` so layouts and actions in the same render do not multiply work.
 */
export const syncPendingStaffInvitationProfile = cache(async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) return;

  const email = normalizeEmail(user.email);

  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try {
    admin = createAdminSupabaseClient();
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[staff-invite] Skipping invitation sync: missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY.",
      );
    }
    return;
  }

  const { data: invite, error: inviteError } = await admin
    .from("staff_invitations")
    .select("id, role, email, full_name, status")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError || !invite?.id || !isRole(invite.role)) return;

  const { full_name, email: profileEmail } = profileFieldsFromStaffInvitation(
    invite,
    user.email,
  );

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role: invite.role,
      full_name,
      email: profileEmail,
    },
    { onConflict: "id" },
  );
  if (upsertError) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[staff-invite] Profile upsert failed during invitation sync:", upsertError.message);
    }
    return;
  }

  const { data: updated, error: updateInviteError } = await admin
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: user.id,
    })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateInviteError || !updated) {
    return;
  }

  await recordAuditEvent({
    action: "staff_invite_accepted",
    actorUserId: user.id,
    metadata: {
      invitationId: invite.id,
      role: invite.role,
      email,
    },
  });
});
