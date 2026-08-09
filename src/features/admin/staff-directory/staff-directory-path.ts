import type { Role } from "@/config/roles";

export function staffDirectoryPath(role: Role): string {
  return `/dashboard/${role}/teachers`;
}

/** Professional record route — param is always `staff_members.id`. */
export function staffProfilePath(
  role: Role,
  staffMemberId: string,
  tab: string = "overview",
): string {
  const base = `${staffDirectoryPath(role)}/${staffMemberId}`;
  return tab === "overview" ? `${base}/overview` : `${base}/${tab}`;
}
