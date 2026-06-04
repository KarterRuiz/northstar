import type { Role } from "@/config/roles";

export function staffDirectoryPath(role: Role): string {
  return `/dashboard/${role}/teachers`;
}
