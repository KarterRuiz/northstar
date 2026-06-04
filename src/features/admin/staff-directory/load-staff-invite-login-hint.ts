import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type StaffInviteLoginHint =
  | {
      ok: true;
      fullName: string;
      emailHint: string;
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
 * Resolves a staff invite recovery token for the login screen (service role; never exposes token).
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
      .select("full_name, email, expires_at, status")
      .eq("invite_token", trimmed)
      .maybeSingle();

    if (error || !data || data.status !== "pending") return { ok: false };

    if (data.expires_at) {
      const ex = new Date(data.expires_at).getTime();
      if (!Number.isNaN(ex) && ex < Date.now()) return { ok: false };
    }

    return {
      ok: true,
      fullName: data.full_name?.trim() || "Invited colleague",
      emailHint: maskEmail(data.email),
    };
  } catch {
    return { ok: false };
  }
}
