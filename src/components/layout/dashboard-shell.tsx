"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { DashboardHubSidebar } from "@/components/layout/dashboard-hub-sidebar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Role } from "@/config/roles";
import { activeRoleFromPath } from "@/lib/breadcrumbs";
import { NORTHSTAR_SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/northstar-sidebar-storage";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
  switcherRoles: Role[];
};

function isRoleWorkspace(role: Role | null): role is Role {
  return role !== null;
}

export function DashboardShell({ children, switcherRoles }: DashboardShellProps) {
  const pathname = usePathname();
  const role = activeRoleFromPath(pathname);
  const sidebarCollapsible = isRoleWorkspace(role);

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (!sidebarCollapsible || typeof window === "undefined") return;
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(NORTHSTAR_SIDEBAR_COLLAPSED_STORAGE_KEY);
        if (raw === "1" || raw === "true") setSidebarCollapsed(true);
      } catch {
        // ignore
      }
    });
  }, [sidebarCollapsible]);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NORTHSTAR_SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const railMode = sidebarCollapsible && sidebarCollapsed;

  return (
    <div className="bg-background text-foreground flex min-h-svh w-full">
      <TooltipProvider delayDuration={280}>
        <aside
          className={cn(
            "bg-sidebar text-sidebar-foreground border-sidebar-border hidden shrink-0 border-r transition-[width] duration-200 ease-out lg:flex lg:min-h-svh lg:flex-col",
            "print:hidden",
            railMode ? "w-[4.5rem]" : "w-72",
          )}
        >
          <div
            id="dashboard-sidebar-nav"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {role ? (
              <SidebarNav
                role={role}
                currentPath={pathname}
                switcherRoles={switcherRoles}
                collapsed={railMode}
                onToggleCollapsed={toggleSidebar}
              />
            ) : (
              <DashboardHubSidebar switcherRoles={switcherRoles} />
            )}
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <div className="print:hidden">
            <TopBar switcherRoles={switcherRoles} />
          </div>
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </TooltipProvider>
    </div>
  );
}
