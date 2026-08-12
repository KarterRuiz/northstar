import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  BookOpen,
  Settings2,
  CalendarCheck,
  ClipboardList,
  FileStack,
  FileText,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  School,
  Users,
} from "lucide-react";
import type { Role } from "@/config/roles";

/** Sidebar nav group labels — keep short and scannable. */
export type NavGroupId =
  | "workspace"
  | "people"
  | "operations"
  | "system";

/** Display labels — sidebar renders these uppercase (WORKSPACE / PEOPLE & CLASSES / …). */
export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  workspace: "Workspace",
  people: "People & Classes",
  operations: "Operations",
  system: "System",
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Overrides default prefix matching for sidebar active state. */
  activeWhen?: (currentPath: string, href: string) => boolean;
};

function teacherClassesNavActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  if (!currentPath.startsWith(`${href}/`)) return false;
  return !/\/classes\/[^/]+\/gradebook(?:\/|$)/.test(currentPath);
}

function teacherGradebookNavActive(currentPath: string, href: string): boolean {
  if (currentPath === href) return true;
  return /\/classes\/[^/]+\/gradebook(?:\/|$)/.test(currentPath);
}

function prefix(role: Role, path: string): string {
  const base = `/dashboard/${role}`;
  return path === "" ? base : `${base}${path}`;
}

type NavSeed = Omit<NavItem, "href"> & { href: string };

function withRole(role: Role, items: NavSeed[]): NavItem[] {
  return items.map((item) => ({
    ...item,
    href: prefix(role, item.href === "" ? "" : item.href),
  }));
}

/** Primary navigation trees per dashboard role. */
export const navigationByRole: Record<Role, NavItem[]> = {
  admin: withRole("admin", [
    { title: "Home", href: "", icon: LayoutDashboard, group: "workspace" },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
      group: "workspace",
    },
    { title: "Students", href: "/students", icon: Users, group: "people" },
    {
      title: "Attendance",
      href: "/attendance",
      icon: CalendarCheck,
      group: "people",
    },
    { title: "Classes", href: "/classes", icon: School, group: "people" },
    {
      title: "Teachers & staff",
      href: "/teachers",
      icon: GraduationCap,
      group: "people",
    },
    {
      title: "Report cards",
      href: "/report-cards",
      icon: FileText,
      group: "operations",
    },
    {
      title: "Follow-Up",
      href: "/follow-up",
      icon: ListChecks,
      group: "operations",
    },
    {
      title: "Parent requests",
      href: "/parent-requests",
      icon: Inbox,
      group: "operations",
    },
    {
      title: "School settings",
      href: "/school-settings",
      icon: Settings2,
      group: "system",
    },
  ]),
  teacher: withRole("teacher", [
    { title: "Home", href: "", icon: LayoutDashboard, group: "workspace" },
    {
      title: "My Classes",
      href: "/classes",
      icon: School,
      group: "people",
      activeWhen: teacherClassesNavActive,
    },
    {
      title: "Gradebook",
      href: "/gradebook",
      icon: BookOpen,
      group: "people",
      activeWhen: teacherGradebookNavActive,
    },
    { title: "Students", href: "/students", icon: Users, group: "people" },
    {
      title: "Attendance",
      href: "/attendance",
      icon: CalendarCheck,
      group: "people",
    },
    {
      title: "Support board",
      href: "/behavior",
      icon: HeartHandshake,
      group: "operations",
    },
    {
      title: "Transition notes",
      href: "/transition-notes",
      icon: NotebookPen,
      group: "operations",
    },
    {
      title: "Interventions",
      href: "/interventions",
      icon: HeartHandshake,
      group: "operations",
    },
    {
      title: "Report cards",
      href: "/report-cards",
      icon: FileText,
      group: "operations",
    },
    { title: "Growth", href: "/growth", icon: BarChart3, group: "operations" },
  ]),
  registrar: withRole("registrar", [
    { title: "Overview", href: "", icon: LayoutDashboard, group: "workspace" },
    { title: "Enrolment", href: "/enrolment", icon: Users, group: "people" },
    {
      title: "Teachers & staff",
      href: "/teachers",
      icon: GraduationCap,
      group: "people",
    },
    {
      title: "Official records",
      href: "/records",
      icon: FileStack,
      group: "operations",
    },
    {
      title: "Parent requests",
      href: "/parent-requests",
      icon: Inbox,
      group: "operations",
    },
    {
      title: "Transcripts",
      href: "/transcripts",
      icon: FileStack,
      group: "operations",
    },
    {
      title: "Report cards",
      href: "/report-cards",
      icon: FileText,
      group: "operations",
    },
    {
      title: "School profile",
      href: "/school-settings",
      icon: Settings2,
      group: "system",
    },
  ]),
  principal: withRole("principal", [
    { title: "Overview", href: "", icon: LayoutDashboard, group: "workspace" },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
      group: "workspace",
    },
    { title: "Classes", href: "/classes", icon: School, group: "people" },
    {
      title: "Teachers & staff",
      href: "/teachers",
      icon: GraduationCap,
      group: "people",
    },
    {
      title: "School overview",
      href: "/school",
      icon: Building2,
      group: "operations",
    },
    {
      title: "Growth analytics",
      href: "/growth",
      icon: BarChart3,
      group: "operations",
    },
    {
      title: "Records oversight",
      href: "/records",
      icon: FileStack,
      group: "operations",
    },
    {
      title: "Follow-Up",
      href: "/follow-up",
      icon: ListChecks,
      group: "operations",
    },
    {
      title: "Parent requests",
      href: "/parent-requests",
      icon: Inbox,
      group: "operations",
    },
    {
      title: "Report cards",
      href: "/report-cards",
      icon: FileText,
      group: "operations",
    },
    {
      title: "School settings",
      href: "/school-settings",
      icon: Settings2,
      group: "system",
    },
  ]),
  vice_principal: withRole("vice_principal", [
    { title: "Overview", href: "", icon: LayoutDashboard, group: "workspace" },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
      group: "workspace",
    },
    { title: "Classes", href: "/classes", icon: School, group: "people" },
    {
      title: "Teachers & staff",
      href: "/teachers",
      icon: GraduationCap,
      group: "people",
    },
    {
      title: "School overview",
      href: "/school",
      icon: Building2,
      group: "operations",
    },
    {
      title: "Growth analytics",
      href: "/growth",
      icon: BarChart3,
      group: "operations",
    },
    {
      title: "Records oversight",
      href: "/records",
      icon: FileStack,
      group: "operations",
    },
    {
      title: "Follow-Up",
      href: "/follow-up",
      icon: ListChecks,
      group: "operations",
    },
    {
      title: "Parent requests",
      href: "/parent-requests",
      icon: Inbox,
      group: "operations",
    },
    {
      title: "Report cards",
      href: "/report-cards",
      icon: FileText,
      group: "operations",
    },
    {
      title: "School settings",
      href: "/school-settings",
      icon: Settings2,
      group: "system",
    },
  ]),
};

/** Group nav items in display order for sidebar sections. */
export function groupNavItems(items: NavItem[]): {
  group: NavGroupId;
  label: string;
  items: NavItem[];
}[] {
  const order: NavGroupId[] = ["workspace", "people", "operations", "system"];
  return order
    .map((group) => ({
      group,
      label: NAV_GROUP_LABELS[group],
      items: items.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}
