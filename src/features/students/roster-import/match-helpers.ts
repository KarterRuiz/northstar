import type {
  RosterContextClass,
  RosterContextGrade,
  RosterContextStudent,
} from "./types";

export function normalizeMatchKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalize class labels so ECG1-1 / ECG1 - 1 / ecg1-1 match. */
export function normalizeClassKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[·•]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-");
}

export function resolveExternalId(values: {
  student_number?: string;
  external_id?: string;
}): string | null {
  const studentNumber = values.student_number?.trim() || "";
  const externalId = values.external_id?.trim() || "";
  const picked = studentNumber || externalId;
  return picked ? picked.slice(0, 64) : null;
}

export function resolvePreferredName(values: {
  preferred_name?: string;
  english_name?: string;
}): string | null {
  const preferred = values.preferred_name?.trim() || "";
  const english = values.english_name?.trim() || "";
  const picked = preferred || english;
  return picked ? picked.slice(0, 120) : null;
}

export function findGradeByLabel(
  grades: RosterContextGrade[],
  label: string | null | undefined,
): RosterContextGrade | null {
  if (!label?.trim()) return null;
  const key = normalizeMatchKey(label);
  for (const g of grades) {
    if (g.isArchived) continue;
    if (normalizeMatchKey(g.name) === key) return g;
    if (g.code && normalizeMatchKey(g.code) === key) return g;
  }
  // Soft match: "5" ↔ "Grade 5"
  const bare = key.replace(/^(grade|year|g)\s*/i, "").trim();
  for (const g of grades) {
    if (g.isArchived) continue;
    const gBare = normalizeMatchKey(g.name).replace(/^(grade|year|g)\s*/i, "").trim();
    if (bare && bare === gBare) return g;
    if (g.code && normalizeMatchKey(g.code).replace(/^g/, "") === bare) return g;
  }
  return null;
}

export function classMatchKeys(klass: RosterContextClass): string[] {
  const name = normalizeMatchKey(klass.name);
  const nameCompact = normalizeClassKey(klass.name);
  const section = klass.section ? normalizeMatchKey(klass.section) : "";
  const sectionCompact = klass.section ? normalizeClassKey(klass.section) : "";
  const grade = normalizeMatchKey(klass.gradeName);
  const keys = new Set<string>();
  keys.add(name);
  keys.add(nameCompact);
  if (section) {
    keys.add(`${name} ${section}`);
    keys.add(`${name} · ${section}`);
    keys.add(`${name}-${section}`);
    keys.add(section);
    keys.add(normalizeClassKey(`${klass.name}-${klass.section}`));
    keys.add(normalizeClassKey(`${klass.name} ${klass.section}`));
  }
  if (sectionCompact) {
    keys.add(sectionCompact);
    keys.add(`${nameCompact}-${sectionCompact}`);
    keys.add(`${nameCompact}${sectionCompact}`);
  }
  keys.add(`${grade} ${name}`);
  keys.add(`${grade} · ${name}`);
  keys.add(normalizeClassKey(`${klass.gradeName}${klass.name}`));
  if (section) {
    keys.add(`${grade} ${name} ${section}`);
    keys.add(`${grade} · ${name} · ${section}`);
  }
  return [...keys];
}

export function findClassByLabel(
  classes: RosterContextClass[],
  classLabel: string | null | undefined,
  gradeLabel: string | null | undefined,
  schoolYearId: string | null,
): RosterContextClass | null {
  if (!classLabel?.trim()) return null;
  const key = normalizeMatchKey(classLabel);
  const compactKey = normalizeClassKey(classLabel);
  const gradeKey = gradeLabel?.trim() ? normalizeMatchKey(gradeLabel) : null;

  const pool = classes.filter(
    (c) => c.isActive && (!schoolYearId || c.schoolYearId === schoolYearId),
  );

  // Prefer exact key matches (spaced and compact).
  for (const c of pool) {
    const keys = classMatchKeys(c);
    const compactKeys = keys.map(normalizeClassKey);
    if (keys.includes(key) || compactKeys.includes(compactKey)) {
      if (gradeKey) {
        const gKeys = [
          normalizeMatchKey(c.gradeName),
          c.gradeCode ? normalizeMatchKey(c.gradeCode) : "",
        ].filter(Boolean);
        if (!gKeys.includes(gradeKey)) {
          // Still allow if class label already embeds grade uniquely.
          const embedsGrade = keys.some((k) => k.includes(gradeKey));
          if (!embedsGrade) continue;
        }
      }
      return c;
    }
  }

  // Combined "Grade · Class" in the class column.
  if (!gradeKey) {
    for (const c of pool) {
      const keys = classMatchKeys(c);
      if (keys.includes(key) || keys.map(normalizeClassKey).includes(compactKey)) {
        return c;
      }
    }
  }

  return null;
}

export function indexStudentsByExternalId(
  students: RosterContextStudent[],
): Map<string, RosterContextStudent> {
  const map = new Map<string, RosterContextStudent>();
  for (const s of students) {
    if (!s.externalId) continue;
    map.set(normalizeMatchKey(s.externalId), s);
  }
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailList(raw: string): string | null {
  const parts = raw
    .split(/[;,/|]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!EMAIL_RE.test(part)) {
      return `"${part}" is not a valid email address.`;
    }
  }
  return null;
}

export function validateDateOfBirth(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // Accept ISO YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY (ambiguous — require sensible ranges).
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidCalendarDate(y, m, d)) return `"${t}" is not a valid date.`;
    return null;
  }

  const slash = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    // Prefer MDY when first part > 12; otherwise accept if either MDY or DMY is valid.
    if (a > 12) {
      if (!isValidCalendarDate(y, b, a)) return `"${t}" is not a valid date.`;
      return null;
    }
    if (b > 12) {
      if (!isValidCalendarDate(y, a, b)) return `"${t}" is not a valid date.`;
      return null;
    }
    if (isValidCalendarDate(y, a, b) || isValidCalendarDate(y, b, a)) return null;
    return `"${t}" is not a valid date.`;
  }

  const parsed = Date.parse(t);
  if (!Number.isFinite(parsed)) {
    return `"${t}" is not a valid date. Use YYYY-MM-DD when possible.`;
  }
  return null;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}
