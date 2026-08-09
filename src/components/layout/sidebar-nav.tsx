import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutDashboard, Shield, School } from "lucide-react";

import { siteConfig } from "@/config/site";
import { roleLabels, type Role } from "@/config/roles";
import { groupNavItems, navigationByRole } from "@/config/navigation";
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

function isNavActive(
  currentPath: string,
  role: Role,
  item: { href: string; activeWhen?: (currentPath: string, href: string) => boolean },
): boolean {
  if (item.activeWhen) return item.activeWhen(currentPath, item.href);
  return (
    currentPath === item.href ||
    (item.href !== `/dashboard/${role}` &&
      currentPath.startsWith(`${item.href}/`))
  );
}

/** Active: deep navy + white. Hover: dark navy + white. 150ms ease-out. */
const navItemBase =
  "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-[color,background-color,box-shadow] duration-150 ease-out";

const navItemIdle =
  "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-xs";

const navItemActive =
  "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm";

export function SidebarNav({
  role,
  currentPath,
  switcherRoles,
  collapsed = false,
  onToggleCollapsed,
}: SidebarNavProps) {
  const items = navigationByRole[role];
  const sections = groupNavItems(items);

  const collapseToggleButton = onToggleCollapsed ? (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "shrink-0 border-sidebar-border bg-card text-sidebar-foreground shadow-none transition-[color,background-color,border-color] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-accent",
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
        <div className="border-sidebar-border flex shrink-0 items-center justify-between gap-0.5 border-b px-1.5 py-2">
          <Link
            href="/dashboard"
            className="text-sidebar-primary-foreground bg-sidebar-primary hover:bg-primary-pressed flex size-7 items-center justify-center rounded-lg text-xs font-semibold tracking-tight transition-colors duration-150 ease-out"
            title={siteConfig.name}
          >
            <span aria-hidden>{brandInitial()}</span>
            <span className="sr-only">{siteConfig.name}</span>
          </Link>
          {collapseToggleButton}
        </div>
        <div className="flex flex-col items-center gap-1 py-2.5">
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
                      "flex size-9 items-center justify-center rounded-lg transition-[color,background-color,box-shadow] duration-150 ease-out",
                      r === role
                        ? navItemActive
                        : navItemIdle,
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
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
        <ScrollArea className="min-h-0 flex-1 py-2.5">
          <nav className="flex flex-col items-center gap-1 px-1.5" aria-label="Section">
            {items.map((item) => {
              const active = isNavActive(currentPath, role, item);
              return (
                <Tooltip key={`${item.title}-${item.href}`}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.title}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg transition-[color,background-color,box-shadow] duration-150 ease-out",
                        active ? navItemActive : navItemIdle,
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
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
          className="hover:bg-surface-muted flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 ease-out"
        >
          <span
            className="bg-sidebar-primary text-sidebar-primary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
            aria-hidden
          >
            {brandInitial()}
          </span>
          <span className="min-w-0 flex flex-col gap-0.5">
            <span className="text-heading text-sm font-semibold tracking-tight">
              {siteConfig.name}
            </span>
            <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
              {siteConfig.tagline}
            </span>
          </span>
        </Link>
        {collapseToggleButton}
      </div>
      <div className="px-3 py-3">
        <p className="text-meta-foreground px-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
          Role
        </p>
        <div className="mt-1.5 grid gap-0.5">
          {switcherRoles.map((r) => (
            <Link
              key={r}
              href={`/dashboard/${r}`}
              className={cn(
                navItemBase,
                r === role ? navItemActive : navItemIdle,
              )}
            >
              {roleLabels[r]}
            </Link>
          ))}
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.group}>
              <p className="text-meta-foreground px-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase">
                {section.label}
              </p>
              <nav className="mt-1.5 grid gap-0.5" aria-label={section.label}>
                {section.items.map((item) => {
                  const active = isNavActive(currentPath, role, item);
                  return (
                    <Link
                      key={`${item.title}-${item.href}`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        navItemBase,
                        active ? navItemActive : navItemIdle,
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
