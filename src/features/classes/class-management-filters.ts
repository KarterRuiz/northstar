/**
 * Pure helpers for Admin Classes list filters and operational summary metrics.
 * Archive source of truth: `classes.is_active` (false = archived).
 */

export type ClassManagementStatusFilter = "active" | "archived";

export type ClassManagementAppliedFilters = {
  q: string;
  status: ClassManagementStatusFilter;
  gradeLevelId: string | null;
};

export type ClassManagementMetricRow = {
  is_active: boolean;
  grade_level_id: string;
  name: string;
  section: string | null;
  gradeLevelName: string;
  teachers: { teacherProfileId: string; teacherLabel: string }[];
  studentEnrollmentCount: number;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Default status is active — archived classes are opt-in via View archive. */
export function parseClassManagementFilters(
  raw: Record<string, string | string[] | undefined> | undefined,
  validGradeIds: Set<string>,
): ClassManagementAppliedFilters {
  const qRaw = firstParam(raw?.q) ?? "";
  const q = qRaw.trim().slice(0, 200);

  const statusRaw = (firstParam(raw?.status) ?? "active").toLowerCase();
  // Legacy `all` (and any unknown value) maps to active operational view.
  const status: ClassManagementStatusFilter =
    statusRaw === "archived" ? "archived" : "active";

  const gradeRaw = firstParam(raw?.grade)?.trim() ?? "";
  const gradeLevelId = validGradeIds.has(gradeRaw) ? gradeRaw : null;

  return { q, status, gradeLevelId };
}

export function classMatchesFilters(
  row: ClassManagementMetricRow,
  filters: ClassManagementAppliedFilters,
): boolean {
  if (filters.status === "active" && !row.is_active) return false;
  if (filters.status === "archived" && row.is_active) return false;

  if (filters.gradeLevelId && row.grade_level_id !== filters.gradeLevelId) {
    return false;
  }

  if (!filters.q) return true;

  const needle = filters.q.toLowerCase();
  const teacherText = row.teachers.map((t) => t.teacherLabel).join(" ").toLowerCase();
  const hay = [row.name, row.section ?? "", row.gradeLevelName, teacherText]
    .join(" ")
    .toLowerCase();

  return hay.includes(needle);
}

/** Operational pulse always uses active classes (search/grade still apply). */
export function operationalFiltersFrom(
  filters: ClassManagementAppliedFilters,
): ClassManagementAppliedFilters {
  return { ...filters, status: "active" };
}

export function summarizeClassManagementMetrics(classes: ClassManagementMetricRow[]): {
  classCount: number;
  teacherCount: number;
  studentCount: number;
} {
  const teacherIds = new Set<string>();
  for (const c of classes) {
    for (const t of c.teachers) {
      teacherIds.add(t.teacherProfileId);
    }
  }
  return {
    classCount: classes.length,
    teacherCount: teacherIds.size,
    studentCount: classes.reduce((sum, c) => sum + c.studentEnrollmentCount, 0),
  };
}

export function buildClassesHref(
  basePath: string,
  next: ClassManagementAppliedFilters,
): string {
  const sp = new URLSearchParams();
  if (next.q.trim()) sp.set("q", next.q.trim());
  // Omit status when active so the clean URL is the operational default.
  if (next.status === "archived") sp.set("status", "archived");
  if (next.gradeLevelId) sp.set("grade", next.gradeLevelId);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function classDisplayName(row: { name: string; section: string | null }): string {
  const base = row.name.trim() || "Class";
  const sec = row.section?.trim();
  return sec ? `${base} ${sec}` : base;
}
