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

export function formatStaffDirectoryName(profile: StaffProfileLabelInput): string {
  const name = profile.full_name?.trim();
  return name || "Name not set";
}

export function formatStaffDirectoryEmail(profile: StaffProfileLabelInput): string {
  const email = profile.email?.trim();
  if (email) return email;
  return `…${shortProfileId(profile.id)}`;
}
