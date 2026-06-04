import type { Role } from "@/config/roles";

import type { AcademicReviewSearchParams } from "./load-academic-review-data";

export function mergeAcademicReviewParams(
  current: AcademicReviewSearchParams,
  patch: Partial<AcademicReviewSearchParams>,
): AcademicReviewSearchParams {
  return { ...current, ...patch };
}

export function academicReviewHref(
  role: Role,
  sp: AcademicReviewSearchParams,
): string {
  const p = new URLSearchParams();
  if (sp.gradeId) p.set("grade", sp.gradeId);
  if (sp.classId) p.set("class", sp.classId);
  if (sp.teacherId) p.set("teacher", sp.teacherId);
  if (sp.tn && sp.tn !== "all") p.set("tn", sp.tn);
  if (sp.rc && sp.rc !== "all") p.set("rc", sp.rc);
  if (sp.sort && sp.sort !== "student") p.set("sort", sp.sort);
  const qs = p.toString();
  return `/dashboard/${role}/academic-review${qs ? `?${qs}` : ""}`;
}
