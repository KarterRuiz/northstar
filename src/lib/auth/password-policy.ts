/** NorthStar password rules (Supabase default minimum is 6; we require 8). */
export const NORTHSTAR_MIN_PASSWORD_LENGTH = 8;

export function validateNorthStarPassword(
  password: string,
  confirm: string,
): { ok: true } | { ok: false; message: string } {
  if (!password.trim() || !confirm.trim()) {
    return { ok: false, message: "Enter and confirm your new password." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match." };
  }
  if (password.length < NORTHSTAR_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${NORTHSTAR_MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  return { ok: true };
}
