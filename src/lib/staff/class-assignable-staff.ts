/**
 * Eligible staff for class staffing (homeroom / additional teachers).
 * Staff directory (`staff_members`) is the source of truth — profile activation is not required.
 */

import type { Role } from "@/config/roles";
import { roleLabels } from "@/config/roles";

/** Roles that may be assigned to a class as instructional staff. */
export const CLASS_ASSIGNABLE_STAFF_ROLES = [
  "teacher",
  "vice_principal",
  "principal",
] as const satisfies readonly Role[];

export type ClassAssignableStaffRole = (typeof CLASS_ASSIGNABLE_STAFF_ROLES)[number];

export function isClassAssignableStaffRole(role: string | null | undefined): role is ClassAssignableStaffRole {
  return (
    typeof role === "string" &&
    (CLASS_ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(role)
  );
}

/** Active roster statuses eligible for new class assignments (excludes disabled/archived). */
export const CLASS_ASSIGNABLE_STAFF_STATUSES = ["draft", "ready"] as const;

export function isClassAssignableStaffStatus(status: string | null | undefined): boolean {
  return (
    typeof status === "string" &&
    (CLASS_ASSIGNABLE_STAFF_STATUSES as readonly string[]).includes(status)
  );
}

export type StaffMemberAssignmentLabelInput = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
};

function staffDisplayName(input: StaffMemberAssignmentLabelInput): string {
  const full = input.full_name?.trim();
  if (full) return full;
  const composed = [input.first_name?.trim(), input.last_name?.trim()].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  return "";
}

/**
 * Human-friendly class assignment label.
 * Prefer `Name — email`; use `No email yet` when email is missing.
 * Never exposes UUIDs.
 */
export function formatStaffMemberAssignmentLabel(input: StaffMemberAssignmentLabelInput): string {
  const name = staffDisplayName(input);
  const email = input.email?.trim();
  if (name && email) return `${name} — ${email}`;
  if (name) return `${name} — No email yet`;
  if (email) return email;

  const roleKey = input.role?.trim();
  const roleLabel =
    roleKey && roleKey in roleLabels
      ? roleLabels[roleKey as Role]
      : roleKey
        ? roleKey.replace(/_/g, " ")
        : "Staff member";
  return `${roleLabel} — No email yet`;
}
