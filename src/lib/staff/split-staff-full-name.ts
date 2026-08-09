/** Split a stored full name into first / last fields for the edit form. */
export function splitStaffFullName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function composeStaffFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}
