import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutDashboard, Shield, School } from "lucide-react";

import { siteConfig } from "@/config/site";
import { roleLabels, type Role } from "@/config/roles";
import { navigationByRole } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SidebarNavProps = {
  role: Role;
  currentPath: string;
  switcherRoles: Role[];
  /** Icon-only rail (desktop); mobile sheet always uses expanded layout */
  collapsed?: boolean;
  /** Desktop sidebar rail toggle (not used on mobile sheet) */
  onToggleCollapsed?: () => void;
};

function roleRailIcon(r: Role) {
  if (r === "admin") return Shield;
  if (r === "teacher") return School;
  return LayoutDashboard;
}

function brandInitial() {
  const trimmed = siteConfig.name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
}

export function SidebarNav({
  role,
  currentPath,
  switcherRoles,
  collapsed = false,
  onToggleCollapsed,
}: SidebarNavProps) {
  const items = navigationByRole[role];

  const collapseToggleButton = onToggleCollapsed ? (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "shrink-0 text-sidebar-foreground border-sidebar-border bg-sidebar/40 shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed ? "size-7" : "size-8",
      )}
      aria-expanded={!collapsed}
      aria-controls="dashboard-sidebar-nav"
      onClick={onToggleCollapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
    >
      {collapsed ? (
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
      )}
    </Button>
  ) : null;

  if (collapsed) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-sidebar-border flex shrink-0 items-center justify-between gap-0.5 border-b px-1 py-1.5">
          <Link
            href="/dashboard"
            className="text-sidebar-foreground hover:bg-sidebar-accent/60 border-sidebar-border/60 flex size-7 items-center justify-center rounded-md border bg-sidebar/30 text-xs font-semibold tracking-tight transition-colors duration-150"
            title={siteConfig.name}
          >
            <span aria-hidden>{brandInitial()}</span>
            <span className="sr-only">{siteConfig.name}</span>
          </Link>
          {collapseToggleButton}
        </div>
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-sidebar-foreground/55 sr-only">Role</span>
          {switcherRoles.map((r) => {
            const Icon = roleRailIcon(r);
            return (
              <Tooltip key={r}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/dashboard/${r}`}
                    title={roleLabels[r]}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md transition-colors duration-150",
                      r === role
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    <span className="sr-only">{roleLabels[r]}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {roleLabels[r]}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <Separator className="bg-sidebar-border" />
        <ScrollArea className="min-h-0 flex-1 py-2">
          <nav className="flex flex-col items-center gap-0.5 px-1" aria-label="Section">
            {items.map((item) => {
              const active = item.activeWhen
                ? item.activeWhen(currentPath, item.href)
                : currentPath === item.href ||
                  (item.href !== `/dashboard/${role}` &&
                    currentPath.startsWith(`${item.href}/`));
              return (
                <Tooltip key={`${item.title}-${item.href}`}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.title}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-md transition-colors duration-150",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0 opacity-90" aria-hidden />
                      <span className="sr-only">{item.title}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-sidebar-border flex items-start gap-2 border-b px-3 py-4">
        <Link
          href="/dashboard"
          className="hover:bg-sidebar-accent/50 flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1 py-0.5 transition-colors duration-150"
        >
          <span className="text-sidebar-foreground/80 text-[11px] font-semibold tracking-wider uppercase">
            {siteConfig.name}
          </span>
          <span className="text-sidebar-foreground line-clamp-2 text-sm font-semibold">
            {siteConfig.tagline}
          </span>
        </Link>
        {collapseToggleButton}
      </div>
      <div className="px-3 py-3">
        <p className="text-sidebar-foreground/55 px-2 text-[11px] font-semibold tracking-wider uppercase">
          Role
        </p>
        <div className="mt-2 grid gap-0.5">
          {switcherRoles.map((r) => (
            <Link
              key={r}
              href={`/dashboard/${r}`}
              className={cn(
                "flex min-h-11 items-center rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                r === role
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground/85",
              )}
            >
              {roleLabels[r]}
            </Link>
          ))}
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <p className="text-sidebar-foreground/55 px-2 text-[11px] font-semibold tracking-wider uppercase">
          Navigation
        </p>
        <nav className="mt-2 grid gap-0.5" aria-label="Section">
          {items.map((item) => {
            const active = item.activeWhen
              ? item.activeWhen(currentPath, item.href)
              : currentPath === item.href ||
                (item.href !== `/dashboard/${role}` &&
                  currentPath.startsWith(`${item.href}/`));
            return (
              <Link
                key={`${item.title}-${item.href}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 lg:min-h-9",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0 opacity-90" />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="text-muted-foreground px-4 py-3 text-xs leading-relaxed">
        Navigation reflects your assigned role from{" "}
        <code className="text-foreground text-[11px]">profiles.role</code>.
      </div>
    </div>
  );
}
