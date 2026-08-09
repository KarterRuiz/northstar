import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type StaffInviteLoginHint =
  | {
      ok: true;
      fullName: string;
      email: string;
      emailHint: string;
      firstName: string;
      lastName: string;
    }
  | { ok: false };

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  if (!local || local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Resolves a staff invite token for the login screen and records opened_at once.
 * Does not ask invitees to choose classes/grades — those were assigned on the roster.
 */
export async function loadStaffInviteLoginHint(
  token: string | undefined,
): Promise<StaffInviteLoginHint> {
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false };

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("staff_invitations")
      .select("id, full_name, first_name, last_name, email, expires_at, status, opened_at")
      .eq("invite_token", trimmed)
      .maybeSingle();

    if (error || !data || data.status !== "pending") return { ok: false };

    if (data.expires_at) {
      const ex = new Date(data.expires_at).getTime();
      if (!Number.isNaN(ex) && ex < Date.now()) return { ok: false };
    }

    if (!data.opened_at) {
      await admin
        .from("staff_invitations")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("status", "pending")
        .is("opened_at", null);
    }

    const firstName =
      data.first_name?.trim() ||
      data.full_name?.trim().split(/\s+/)[0] ||
      "Colleague";
    const lastName =
      data.last_name?.trim() ||
      data.full_name?.trim().split(/\s+/).slice(1).join(" ") ||
      "";

    return {
      ok: true,
      fullName: data.full_name?.trim() || "Invited colleague",
      email: data.email,
      emailHint: maskEmail(data.email),
      firstName,
      lastName,
    };
  } catch {
    return { ok: false };
  }
}
