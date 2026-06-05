/**
 * Lightweight format check for typical sign-in addresses (after trim/lower normalization).
 * Not a full RFC 5322 parser; pairs with the invite form's `type="email"`.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || email.length > 254) return false;
  const match = /^([^@\s]+)@([^@\s]+)$/.exec(email);
  if (!match) return false;
  const [, local, domain] = match;
  if (local.length === 0 || local.length > 64) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return true;
}
