"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/config/roles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { staffProfilePath } from "@/features/admin/staff-directory/staff-directory-path";
import { cn } from "@/lib/utils";

import {
  STAFF_PROFILE_TAB_IDS,
  resolveStaffProfileTabId,
  type StaffProfileTabId,
} from "./constants";

const TAB_LABELS: Record<StaffProfileTabId, string> = {
  overview: "Overview",
  classes: "Classes & Academics",
  attendance: "Attendance Compliance",
  "student-records": "Student Records",
  "professional-notes": "Professional Notes",
  "files-activity": "Files & Activity",
};

type StaffProfileTabsProps = {
  role: Role;
  staffMemberId: string;
};

function activeTabFromPath(pathname: string): StaffProfileTabId {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return resolveStaffProfileTabId(last);
}

export function StaffProfileTabs({ role, staffMemberId }: StaffProfileTabsProps) {
  const pathname = usePathname();
  const value = activeTabFromPath(pathname);

  return (
    <Tabs value={value} className="w-full">
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 md:mx-0 md:px-0">
        <TabsList
          aria-label="Staff profile sections"
          className={cn(
            "h-auto min-h-9 w-max max-w-none flex-nowrap justify-start gap-0.5 p-1",
            "bg-muted/80 border-border/60 inline-flex rounded-lg border shadow-none",
          )}
        >
          {STAFF_PROFILE_TAB_IDS.map((id) => (
            <TabsTrigger
              key={id}
              value={id}
              asChild
              className={cn(
                "shrink-0 rounded-md px-3 py-2.5 text-xs font-medium min-h-11 sm:min-h-9 sm:text-sm",
                "text-muted-foreground data-[state=active]:text-foreground",
                "data-[state=active]:bg-background data-[state=active]:border-border/80 data-[state=active]:border data-[state=active]:shadow-sm",
              )}
            >
              <Link href={staffProfilePath(role, staffMemberId, id)} prefetch>
                {TAB_LABELS[id]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
