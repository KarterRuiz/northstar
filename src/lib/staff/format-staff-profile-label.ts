import { roleLabels, type Role } from "@/config/roles";

export type StaffProfileLabelInput = {
  id: string;
  role?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export function shortProfileId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

/** Dropdown / picker label: `full_name — email`, else `Role …shortId`. */
export function formatStaffProfileLabel(profile: StaffProfileLabelInput): string {
  const name = profile.full_name?.trim();
  const email = profile.email?.trim();
  if (name && email) return `${name} — ${email}`;
  if (name) return name;
  if (email) return email;

  const roleKey = profile.role?.trim();
  const roleLabel =
    roleKey && roleKey in roleLabels
      ? roleLabels[roleKey as Role]
      : roleKey
        ? roleKey.replace(/_/g, " ")
        : "Staff";
  return `${roleLabel} …${shortProfileId(profile.id)}`;
}

/**
 * Primary directory identity. Prefer full name; fall back to email so incomplete
 * profiles are still recognizable without exposing internal IDs.
 */
export function formatStaffDirectoryName(profile: StaffProfileLabelInput): string {
  const name = profile.full_name?.trim();
  if (name) return name;
  const email = profile.email?.trim();
  if (email) return email;
  return "Staff member";
}

export function isStaffDirectorySetupIncomplete(profile: StaffProfileLabelInput): boolean {
  return !profile.full_name?.trim();
}

export function formatStaffDirectoryEmail(profile: StaffProfileLabelInput): string {
  const email = profile.email?.trim();
  if (email) return email;
  return "—";
}
