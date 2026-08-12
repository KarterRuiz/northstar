export const roles = [
  "admin",
  "teacher",
  "registrar",
  "principal",
  "vice_principal",
] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  teacher: "Teacher",
  registrar: "Registrar",
  principal: "Principal",
  vice_principal: "Vice principal",
};

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

export function roleDashboardHref(role: Role): string {
  return `/dashboard/${role}`;
}

/**
 * Role workspaces shown in the dashboard sidebar switcher for a signed-in user.
 * Must match `profiles.role` — users only see the dashboard they are authorized for.
 */
export function dashboardSwitcherRoles(profileRole: Role): readonly Role[] {
  return [profileRole];
}

/** Roles that may open a student profile in the dashboard (matches student profile layout). */
export function isStudentProfileViewerRole(role: Role): boolean {
  return (
    role === "admin" ||
    role === "teacher" ||
    role === "principal" ||
    role === "vice_principal" ||
    role === "registrar"
  );
}

/** Server-side gate for audit history tab and API-style checks. */
export function isLeadershipAuditRole(role: Role): boolean {
  return role === "admin" || role === "principal" || role === "vice_principal";
}

/** Admins and school leadership may create/edit student records (server actions must re-check). */
export function canManageStudents(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/**
 * Official class enrollment (add / remove students from a class roster).
 * Leadership only. Teachers view and work with the assigned roster.
 */
export function canManageClassEnrollment(role: Role): boolean {
  return canManageStudents(role);
}

/** Teachers may edit basic identity fields for students on their assigned class rosters. */
export function canTeacherEditStudentBasicInfo(role: Role): boolean {
  return role === "teacher";
}

/** School years, grade levels, classes, and teacher assignments (matches RLS `is_school_leadership`). */
export function canManageSchoolStructure(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/**
 * Parent record requests and official student record packet export (matches tightened RLS:
 * `is_school_leadership` or `is_registrar`).
 */
export function canManageParentRecordRequests(role: Role): boolean {
  return (
    role === "admin" ||
    role === "principal" ||
    role === "vice_principal" ||
    role === "registrar"
  );
}

export function canUploadReportCards(role: Role): boolean {
  return (
    role === "admin" ||
    role === "teacher" ||
    role === "registrar" ||
    role === "principal" ||
    role === "vice_principal"
  );
}

/** Search / filter / archive registry (admin, registrar, school leadership). */
export function canSearchReportCardRegistry(role: Role): boolean {
  return (
    role === "admin" ||
    role === "registrar" ||
    role === "principal" ||
    role === "vice_principal"
  );
}

/** Update lifecycle status (draft / final / archive) in DB. */
export function canManageReportCardLifecycle(role: Role): boolean {
  return canSearchReportCardRegistry(role);
}

/** Void mistaken teacher-generated report card PDFs (audit retained). */
export function canVoidGeneratedReportCard(role: Role): boolean {
  return role === "admin" || role === "principal" || role === "vice_principal";
}

/**
 * Leadership Follow-Up workspace (`public.follow_ups` RLS: `is_school_leadership`).
 * Teachers and registrars are excluded — this surface can include notes about staff.
 */
export function canAccessFollowUp(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/**
 * School Calendar write + leadership notes (`school_events` insert/update + `calendar_notes`).
 * Leadership only. Teachers may *view* staff-visible events via `canViewCalendar`.
 * Registrar is excluded — notes can mention staff, and planning is leadership work.
 */
export function canAccessCalendar(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/**
 * Read-only school calendar (Home preview + `/calendar` workspace).
 * Teachers see All Staff / Whole School only — RLS already hides leadership
 * events and every calendar note. Does not grant create/edit.
 */
export function canViewCalendar(role: Role): boolean {
  return isLeadershipAuditRole(role) || role === "teacher";
}

/** Private leadership date notes — never teachers, students, or families. */
export function canManageCalendarNotes(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/** Matches `transition_notes` RLS: leadership and registrar may review, reopen, and archive. */
export function canModerateTransitionNotes(role: Role): boolean {
  return (
    role === "admin" ||
    role === "principal" ||
    role === "vice_principal" ||
    role === "registrar"
  );
}

/** Matches `academic_records` leadership update policy (review/archive). */
export function canModerateAcademicRecords(role: Role): boolean {
  return role === "admin" || role === "principal" || role === "vice_principal";
}

/** Matches `school_settings` SELECT RLS (leadership + registrar). */
export function canViewSchoolSettings(role: Role): boolean {
  return isLeadershipAuditRole(role) || role === "registrar";
}

/** Matches `school_settings` INSERT/UPDATE RLS (school leadership only). */
export function canEditSchoolSettings(role: Role): boolean {
  return isLeadershipAuditRole(role);
}

/** Staff directory, invitations, and role changes (`is_staff_directory_manager` in DB). */
export function canManageStaffDirectory(role: Role | string): boolean {
  return (
    role === "admin" ||
    role === "principal" ||
    role === "vice_principal" ||
    role === "registrar"
  );
}
