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
  NotebookPen,
  School,
  Users,
} from "lucide-react";
import type { Role } from "@/config/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
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

/** Primary navigation trees per dashboard role. */
export const navigationByRole: Record<Role, NavItem[]> = {
  admin: [
    { title: "Overview", href: "", icon: LayoutDashboard },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
    },
    { title: "Students", href: "/students", icon: Users },
    { title: "Attendance", href: "/attendance", icon: CalendarCheck },
    { title: "Classes", href: "/classes", icon: School },
    { title: "Teachers", href: "/teachers", icon: GraduationCap },
    { title: "Report cards", href: "/report-cards", icon: FileText },
    { title: "Transition notes", href: "/transition-notes", icon: NotebookPen },
    { title: "Parent requests", href: "/parent-requests", icon: Inbox },
    { title: "School settings", href: "/school-settings", icon: Settings2 },
  ].map((item) => ({
    ...item,
    href: prefix("admin", item.href === "" ? "" : item.href),
  })),
  teacher: [
    { title: "Overview", href: "", icon: LayoutDashboard },
    {
      title: "My classes",
      href: "/classes",
      icon: School,
      activeWhen: teacherClassesNavActive,
    },
    {
      title: "Gradebook",
      href: "/gradebook",
      icon: BookOpen,
      activeWhen: teacherGradebookNavActive,
    },
    { title: "Students", href: "/students", icon: Users },
    { title: "Attendance", href: "/attendance", icon: CalendarCheck },
    { title: "Support board", href: "/behavior", icon: HeartHandshake },
    {
      title: "Transition notes",
      href: "/transition-notes",
      icon: NotebookPen,
    },
    {
      title: "Interventions",
      href: "/interventions",
      icon: HeartHandshake,
    },
    { title: "Report cards", href: "/report-cards", icon: FileText },
    { title: "Growth", href: "/growth", icon: BarChart3 },
  ].map((item) => ({
    ...item,
    href: prefix("teacher", item.href === "" ? "" : item.href),
  })),
  registrar: [
    { title: "Overview", href: "", icon: LayoutDashboard },
    { title: "Enrolment", href: "/enrolment", icon: Users },
    { title: "Official records", href: "/records", icon: FileStack },
    { title: "Parent requests", href: "/parent-requests", icon: Inbox },
    { title: "Transcripts", href: "/transcripts", icon: FileStack },
    { title: "Report cards", href: "/report-cards", icon: FileText },
    { title: "School profile", href: "/school-settings", icon: Settings2 },
  ].map((item) => ({
    ...item,
    href: prefix("registrar", item.href === "" ? "" : item.href),
  })),
  principal: [
    { title: "Overview", href: "", icon: LayoutDashboard },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
    },
    { title: "Classes", href: "/classes", icon: School },
    { title: "School overview", href: "/school", icon: Building2 },
    { title: "Growth analytics", href: "/growth", icon: BarChart3 },
    { title: "Records oversight", href: "/records", icon: FileStack },
    { title: "Parent requests", href: "/parent-requests", icon: Inbox },
    { title: "Report cards", href: "/report-cards", icon: FileText },
    { title: "School settings", href: "/school-settings", icon: Settings2 },
  ].map((item) => ({
    ...item,
    href: prefix("principal", item.href === "" ? "" : item.href),
  })),
  vice_principal: [
    { title: "Overview", href: "", icon: LayoutDashboard },
    {
      title: "Academic review",
      href: "/academic-review",
      icon: ClipboardList,
    },
    { title: "Classes", href: "/classes", icon: School },
    { title: "School overview", href: "/school", icon: Building2 },
    { title: "Growth analytics", href: "/growth", icon: BarChart3 },
    { title: "Records oversight", href: "/records", icon: FileStack },
    { title: "Parent requests", href: "/parent-requests", icon: Inbox },
    { title: "Report cards", href: "/report-cards", icon: FileText },
    { title: "School settings", href: "/school-settings", icon: Settings2 },
  ].map((item) => ({
    ...item,
    href: prefix("vice_principal", item.href === "" ? "" : item.href),
  })),
};
