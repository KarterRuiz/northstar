import { roleLabels, isRole, type Role } from "@/config/roles";

export type Crumb = { label: string; href?: string };

const segmentTitle: Record<string, string> = {
  dashboard: "Dashboard",
  students: "Students",
  import: "Import roster",
  overview: "Overview",
  grades: "Grades",
  academics: "Academics",
  interventions: "Interventions",
  attendance: "Attendance",
  behavior: "Behavior",
  "student-support": "Student support",
  "academic-records": "Academic record",
  gradebook: "Gradebook",
  "report-cards": "Report cards",
  workspace: "Report cards",
  preview: "Preview",
  "transition-notes": "Transition notes",
  files: "Files",
  documents: "Documents",
  "parent-communication": "Parent communication",
  "audit-history": "Audit history",
  directory: "Directory",
  records: "Records",
  growth: "Growth",
  compliance: "Compliance",
  settings: "School settings",
  classes: "Classes",
  teachers: "Teachers & staff",
  assignment: "Classes & academics",
  observations: "Professional notes",
  "professional-notes": "Professional notes",
  "student-records": "Student records",
  "files-activity": "Files & activity",
  activity: "Activity",
  "parent-requests": "Parent requests",
  actions: "Quick actions",
  enrolment: "Enrolment",
  transcripts: "Transcripts",
  school: "School overview",
  "school-settings": "School settings",
  "record-packet": "Record packet",
};

type TitleizeOpts = {
  /** Role segment from `/dashboard/:role/…` when present. */
  dashboardRole?: Role;
  /** Previous path segment (used to label UUID crumbs). */
  previousSegment?: string;
};

function titleize(segment: string, opts?: TitleizeOpts): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    if (opts?.previousSegment === "parent-requests") return "Request";
    if (opts?.previousSegment === "students") return "Student";
    if (opts?.previousSegment === "teachers") return "Staff";
    return "Details";
  }
  if (/^stu-/.test(segment)) {
    return "Student";
  }
  if (segment === "classes" && opts?.dashboardRole === "teacher") {
    return "My classes";
  }
  // Staff profile: /teachers/:staffMemberId/classes
  if (
    segment === "classes" &&
    opts?.previousSegment &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      opts.previousSegment,
    )
  ) {
    return "Classes & academics";
  }
  // `/new` is reused across flows; label from the parent segment.
  if (segment === "new") {
    if (opts?.previousSegment === "students") return "Add student";
    if (opts?.previousSegment === "transition-notes") return "New note";
    if (opts?.previousSegment === "parent-requests") return "New request";
    if (opts?.previousSegment === "academic-records") return "New record";
    return "New";
  }
  if (segmentTitle[segment]) return segmentTitle[segment];
  if (isRole(segment)) return roleLabels[segment];
  return segment
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function getBreadcrumbs(pathname: string): Crumb[] {
  const raw = pathname.split("/").filter(Boolean);
  if (raw.length === 0) return [{ label: "Home", href: "/" }];

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];

  if (raw[0] === "dashboard") {
    crumbs.push({ label: "Dashboard", href: "/dashboard" });
    const rest = raw.slice(1);
    if (rest.length === 0) return crumbs;

    const dashboardRole =
      rest[0] && isRole(rest[0]) ? (rest[0] as Role) : undefined;

    let acc = "/dashboard";
    for (let i = 0; i < rest.length; i++) {
      const seg = rest[i]!;
      const prev = i > 0 ? rest[i - 1] : undefined;
      acc += `/${seg}`;
      const isLast = i === rest.length - 1;
      crumbs.push({
        label: titleize(seg, { dashboardRole, previousSegment: prev }),
        href: isLast ? undefined : acc,
      });
    }
  } else {
    let acc = "";
    for (let i = 0; i < raw.length; i++) {
      const seg = raw[i]!;
      acc += `/${seg}`;
      const isLast = i === raw.length - 1;
      crumbs.push({
        label: titleize(seg),
        href: isLast ? undefined : acc,
      });
    }
  }

  return crumbs;
}

export function activeRoleFromPath(pathname: string): Role | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  const candidate = match?.[1];
  if (!candidate) return null;
  return isRole(candidate) ? candidate : null;
}

export function humanizePathSegments(
  segments: string[] | undefined,
  dashboardRole?: Role,
): string {
  if (!segments || segments.length === 0) return "Overview";
  return segments
    .map((segment) => titleize(segment, { dashboardRole }))
    .join(" · ");
}
