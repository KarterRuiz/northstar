import "server-only";

export type StaffInvitationProfileFields = {
  full_name: string | null;
  email: string | null;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Build `profiles` display fields from a staff invitation; auth email is a secondary source. */
export function profileFieldsFromStaffInvitation(
  invite: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  },
  authEmail?: string | null,
): StaffInvitationProfileFields {
  const fromParts = [invite.first_name?.trim(), invite.last_name?.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  const full_name =
    invite.full_name?.trim() ||
    (fromParts.length > 0 ? fromParts : null);
  const inviteEmail = invite.email?.trim() ? normalizeEmail(invite.email) : null;
  const fromAuth =
    authEmail?.trim() ? normalizeEmail(authEmail) : null;
  return {
    full_name,
    email: inviteEmail ?? fromAuth ?? null,
  };
}
