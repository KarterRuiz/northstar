/** Login URL with `staff_invite` token so the invitee can complete sign-in. */
export function buildStaffInviteLink(loginBaseUrl: string, inviteToken: string): string {
  try {
    const u = new URL(loginBaseUrl);
    u.searchParams.set("staff_invite", inviteToken);
    return u.toString();
  } catch {
    const base = loginBaseUrl.replace(/\/$/, "");
    return `${base}?staff_invite=${encodeURIComponent(inviteToken)}`;
  }
}
