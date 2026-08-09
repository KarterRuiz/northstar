import Link from "next/link";

import { siteConfig } from "@/config/site";
import { roleLabels, type Role } from "@/config/roles";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type DashboardHubSidebarProps = {
  switcherRoles: Role[];
};

function brandInitial() {
  const trimmed = siteConfig.name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
}

export function DashboardHubSidebar({ switcherRoles }: DashboardHubSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-sidebar-border border-b px-4 py-4">
        <div className="flex items-start gap-2.5">
          <span
            className="bg-sidebar-primary text-sidebar-primary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
            aria-hidden
          >
            {brandInitial()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-heading text-sm font-semibold tracking-tight">
              {siteConfig.name}
            </span>
            <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
              {siteConfig.tagline}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-meta-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
          Workspace
        </p>
        <p className="ns-muted -mt-1">
          Choose a workspace for your role.
        </p>
        <div className="grid gap-0.5">
          {switcherRoles.map((r) => (
            <Link
              key={r}
              href={`/dashboard/${r}`}
              className={cn(
                "rounded-lg px-2.5 py-2.5 text-sm transition-[color,background-color,box-shadow] duration-150 ease-out",
                "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-xs",
              )}
            >
              {roleLabels[r]}
            </Link>
          ))}
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="ns-meta px-4 py-3">
        Need another role? Ask a school administrator.
      </div>
    </div>
  );
}
