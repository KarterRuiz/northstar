"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isLeadershipAuditRole, type Role } from "@/config/roles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  STUDENT_PROFILE_TAB_IDS,
  STUDENT_PROFILE_TAB_SEGMENT_ALIASES,
  isStudentProfileTabId,
  type StudentProfileTabId,
} from "./constants";

const TAB_LABELS: Record<StudentProfileTabId, string> = {
  overview: "Overview",
  academics: "Academics",
  attendance: "Attendance",
  behavior: "Behavior",
  interventions: "Interventions",
  "parent-communication": "Parent communication",
  documents: "Documents",
  "report-cards": "Report cards",
  "transition-notes": "Transition notes",
  "audit-history": "Audit history",
};

const TAB_HINTS: Record<StudentProfileTabId, string> = {
  overview:
    "Pulse check: attendance, support, interventions, family requests, and report readiness.",
  academics:
    "Class gradebook summary plus structured academic records — same calculations as the class view.",
  attendance: "Term absences, tardies, recent marks, and attendance pattern indicators.",
  behavior: "Strengths, strategies, support moments, and follow-ups from class.",
  interventions: "Active supports, academic flags, and intervention timelines.",
  "parent-communication":
    "Formal parent record requests and classroom-documented caregiver communication.",
  documents: "File labels, storage paths, and (where permitted) report card uploads.",
  "report-cards":
    "Official PDFs (draft, final, or archived) with audited, short-lived signed download links.",
  "transition-notes": "Program handoffs and continuity notes when recorded.",
  "audit-history": "Who did what, when — limited to leadership and admin roles.",
};

type StudentProfileTabsProps = {
  role: Role;
  studentId: string;
};

function activeTabFromPath(pathname: string): StudentProfileTabId {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  const aliased = STUDENT_PROFILE_TAB_SEGMENT_ALIASES[last];
  if (aliased) return aliased;
  return isStudentProfileTabId(last) ? last : "overview";
}

export function StudentProfileTabs({ role, studentId }: StudentProfileTabsProps) {
  const pathname = usePathname();

  if (pathname.includes("/record-packet") || pathname.endsWith("/edit")) {
    return null;
  }

  const value = activeTabFromPath(pathname);
  const base = `/dashboard/${role}/students/${studentId}`;
  const tabIds = STUDENT_PROFILE_TAB_IDS.filter(
    (id) => id !== "audit-history" || isLeadershipAuditRole(role),
  );

  return (
    <Tabs value={value} className="w-full space-y-3">
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 md:mx-0 md:px-0">
        <TabsList
          aria-label="Student profile sections"
          className={cn(
            "h-auto min-h-9 w-max max-w-none flex-nowrap justify-start gap-0.5 p-1",
            "bg-muted/80 border-border/60 inline-flex rounded-lg border shadow-none",
          )}
        >
          {tabIds.map((id) => (
            <TabsTrigger
              key={id}
              value={id}
              asChild
              className={cn(
                "shrink-0 rounded-md px-3 py-2.5 text-xs font-medium min-h-11 sm:min-h-9 sm:text-sm lg:min-h-9",
                "text-muted-foreground data-[state=active]:text-foreground",
                "data-[state=active]:bg-background data-[state=active]:border-border/80 data-[state=active]:border data-[state=active]:shadow-sm",
              )}
            >
              <Link href={`${base}/${id}`} prefetch>
                {TAB_LABELS[id]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed sm:text-[13px]">
        {TAB_HINTS[value]}
      </p>
    </Tabs>
  );
}
