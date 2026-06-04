import "server-only";

import { cache } from "react";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { profileFieldsFromStaffInvitation } from "@/lib/staff/profile-fields-from-invitation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PENDING_INVITE_TEACHER_CLASS_ROLE = "co_teacher" as const;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * When a signed-in user's email matches a pending `staff_invitations` row, upserts `profiles.role`
 * from the invite and marks the invitation accepted. Idempotent: repeats are no-ops once the
 * invite is no longer pending. Uses the service role for `profiles` / `staff_invitations` writes
 * because the sync runs before the session reliably satisfies broad staff-manager RLS. The caller's
 * identity is taken from the session via `auth.getUser()` only.
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
    .select(
      "id, role, email, full_name, first_name, last_name, status, pending_class_ids, expires_at",
    )
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError || !invite?.id || !isRole(invite.role)) return;

  if (invite.expires_at) {
    const ex = new Date(invite.expires_at).getTime();
    if (!Number.isNaN(ex) && ex < Date.now()) {
      return;
    }
  }

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

  if (invite.role === "teacher" && Array.isArray(invite.pending_class_ids)) {
    for (const classId of invite.pending_class_ids) {
      if (typeof classId !== "string") continue;
      const { error: ctError } = await admin.from("class_teachers").insert({
        class_id: classId,
        teacher_profile_id: user.id,
        role: PENDING_INVITE_TEACHER_CLASS_ROLE,
      });
      if (ctError && ctError.code !== "23505" && process.env.NODE_ENV === "development") {
        console.warn("[staff-invite] class_teachers insert:", ctError.message);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateInviteError } = await admin
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_user_id: user.id,
      accepted_at: nowIso,
      pending_class_ids: [],
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
