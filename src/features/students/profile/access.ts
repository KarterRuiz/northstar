import { notFound } from "next/navigation";

import type { Role } from "@/config/roles";

const STUDENT_DIRECTORY_ROLES: readonly Role[] = [
  "admin",
  "principal",
  "vice_principal",
  "registrar",
  "teacher",
] as const;

/** Who may open `/dashboard/:role/students` (RLS still scopes rows for teachers). */
export function assertStudentDirectoryAccess(role: Role) {
  if (!(STUDENT_DIRECTORY_ROLES as readonly string[]).includes(role)) {
    notFound();
  }
}

/** @deprecated Use assertStudentDirectoryAccess */
export function assertAdminStudentsAccess(role: Role) {
  assertStudentDirectoryAccess(role);
}
