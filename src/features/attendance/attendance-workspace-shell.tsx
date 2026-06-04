"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";

import type { AttendanceTab } from "./attendance-utils";

export type { AttendanceTab } from "./attendance-utils";

const BASE = "/dashboard/teacher/attendance";

const TABS: { id: AttendanceTab; label: string }[] = [
  { id: "daily", label: "Daily entry" },
  { id: "weekly", label: "Weekly review" },
  { id: "monthly", label: "Monthly review" },
  { id: "concerns", label: "Attendance concerns" },
];

type AttendanceWorkspaceShellProps = {
  tab: AttendanceTab;
  /** Server-rendered body for the active tab only (avoids loading all panels). */
  activePanel: ReactNode;
};

export function AttendanceWorkspaceShell({
  tab,
  activePanel,
}: AttendanceWorkspaceShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onTabChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "daily") params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    router.push(q ? `${BASE}?${q}` : BASE);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Attendance"
        description="Daily entry, weekly and monthly review, and term concern flags for your classes."
      />

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="daily">{tab === "daily" ? activePanel : null}</TabsContent>
        <TabsContent value="weekly">{tab === "weekly" ? activePanel : null}</TabsContent>
        <TabsContent value="monthly">{tab === "monthly" ? activePanel : null}</TabsContent>
        <TabsContent value="concerns">{tab === "concerns" ? activePanel : null}</TabsContent>
      </Tabs>
    </div>
  );
}
