"use client";

import { Menu } from "lucide-react";

import { siteConfig } from "@/config/site";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { DashboardHubSidebar } from "@/components/layout/dashboard-hub-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/config/roles";
import { activeRoleFromPath } from "@/lib/breadcrumbs";

type MobileNavProps = {
  pathname: string;
  switcherRoles: Role[];
};

export function MobileNav({ pathname, switcherRoles }: MobileNavProps) {
  const role = activeRoleFromPath(pathname);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(100%,20rem)] max-w-[85vw] border-r bg-sidebar p-0 transition-transform duration-200 ease-out"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{siteConfig.shortName} navigation</SheetTitle>
        </SheetHeader>
        <div className="text-sidebar-foreground h-svh overflow-y-auto overscroll-contain">
          {role ? (
            <SidebarNav
              role={role}
              currentPath={pathname}
              switcherRoles={switcherRoles}
            />
          ) : (
            <DashboardHubSidebar switcherRoles={switcherRoles} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
