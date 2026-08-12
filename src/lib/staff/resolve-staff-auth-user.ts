import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type ResolvedStaffAuthUser = {
  userId: string;
  email: string;
  confirmed: boolean;
};

/**
 * Locate a Supabase Auth user for a staff email without sending mail.
 * Prefers a known Auth user id (e.g. staff_invitations.accepted_user_id), then
 * falls back to generateLink(invite) which returns the existing Auth row.
 */
export async function resolveStaffAuthUser(args: {
  email: string;
  knownAuthUserId?: string | null;
  adminClient?: ReturnType<typeof createAdminSupabaseClient>;
}): Promise<ResolvedStaffAuthUser | null> {
  const email = normalizeEmail(args.email);
  if (!email) return null;

  let adminClient = args.adminClient;
  if (!adminClient) {
    try {
      adminClient = createAdminSupabaseClient();
    } catch {
      return null;
    }
  }

  const knownId = args.knownAuthUserId?.trim() || null;
  if (knownId) {
    const { data, error } = await adminClient.auth.admin.getUserById(knownId);
    if (!error && data?.user) {
      const userEmail = normalizeEmail(data.user.email ?? "");
      if (userEmail === email) {
        return {
          userId: data.user.id,
          email: userEmail,
          confirmed: Boolean(data.user.email_confirmed_at),
        };
      }
    }
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
  });

  if (linkError || !linkData?.user?.id) {
    return null;
  }

  const userEmail = normalizeEmail(linkData.user.email ?? "");
  if (userEmail !== email) {
    return null;
  }

  return {
    userId: linkData.user.id,
    email: userEmail,
    confirmed: Boolean(linkData.user.email_confirmed_at),
  };
}

/**
 * Batch-resolve Auth confirmation for known user ids (directory page enrichment).
 * Skips emails that have no known id — callers should not N+1 generateLink.
 */
export async function resolveStaffAuthUsersByIds(
  entries: { staffMemberId: string; authUserId: string; email: string }[],
): Promise<Map<string, ResolvedStaffAuthUser>> {
  const out = new Map<string, ResolvedStaffAuthUser>();
  if (entries.length === 0) return out;

  let adminClient: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminClient = createAdminSupabaseClient();
  } catch {
    return out;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const email = normalizeEmail(entry.email);
      const { data, error } = await adminClient.auth.admin.getUserById(entry.authUserId);
      if (error || !data?.user) return;
      const userEmail = normalizeEmail(data.user.email ?? "");
      if (userEmail !== email) return;
      out.set(entry.staffMemberId, {
        userId: data.user.id,
        email: userEmail,
        confirmed: Boolean(data.user.email_confirmed_at),
      });
    }),
  );

  return out;
}
