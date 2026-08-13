"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/config/roles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  CLASS_DATA_CENTER_TAB_IDS,
  CLASS_DATA_CENTER_TAB_LABELS,
  classDataCenterPath,
  isClassDataCenterTabId,
  type ClassDataCenterTabId,
} from "./constants";

function activeTabFromPath(pathname: string): ClassDataCenterTabId {
  const parts = pathname.split("/").filter(Boolean);
  const classesIdx = parts.indexOf("classes");
  const afterClass = classesIdx >= 0 ? parts[classesIdx + 2] : undefined;
  if (afterClass === "gradebook") return "academics";
  if (afterClass && isClassDataCenterTabId(afterClass)) return afterClass;
  return "overview";
}

export function ClassDataCenterTabs({
  role,
  classId,
}: {
  role: Role;
  classId: string;
}) {
  const pathname = usePathname();
  const value = activeTabFromPath(pathname);

  return (
    <Tabs value={value} className="w-full">
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 md:mx-0 md:px-0">
        <TabsList
          aria-label="Class data center sections"
          className={cn(
            "h-auto min-h-9 w-max max-w-none flex-nowrap justify-start gap-0.5 p-1",
            "bg-muted/80 border-border/60 inline-flex rounded-lg border shadow-none",
          )}
        >
          {CLASS_DATA_CENTER_TAB_IDS.map((id) => {
            const active = value === id;
            return (
              <TabsTrigger
                key={id}
                value={id}
                asChild
                className={cn(
                  "shrink-0 rounded-md px-3 py-2.5 text-xs font-medium min-h-11 sm:min-h-9 sm:text-sm",
                  "text-muted-foreground hover:text-heading data-[state=active]:text-foreground",
                  "data-[state=active]:bg-background data-[state=active]:border-border/80 data-[state=active]:border data-[state=active]:shadow-sm",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                <Link
                  href={classDataCenterPath(role, classId, id)}
                  prefetch
                  aria-current={active ? "page" : undefined}
                >
                  {CLASS_DATA_CENTER_TAB_LABELS[id]}
                </Link>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
