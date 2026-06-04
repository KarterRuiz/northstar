import Link from "next/link";

import { siteConfig } from "@/config/site";
import { roleLabels, type Role } from "@/config/roles";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type DashboardHubSidebarProps = {
  switcherRoles: Role[];
};

export function DashboardHubSidebar({ switcherRoles }: DashboardHubSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-sidebar-foreground/80 text-[11px] font-semibold tracking-wider uppercase">
            {siteConfig.name}
          </span>
          <span className="text-sidebar-foreground line-clamp-2 text-sm font-semibold">
            {siteConfig.tagline}
          </span>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Open your assigned workspace. Other role dashboards are not available
          for your account.
        </p>
        <div className="grid gap-0.5">
          {switcherRoles.map((r) => (
            <Link
              key={r}
              href={`/dashboard/${r}`}
              className={cn(
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2.5 py-2.5 text-sm transition-colors duration-150",
                "text-sidebar-foreground/90",
              )}
            >
              {roleLabels[r]}
            </Link>
          ))}
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="text-muted-foreground px-4 py-3 text-xs leading-relaxed">
        Navigation reflects your assigned role from{" "}
        <code className="text-foreground text-[11px]">profiles.role</code>.
      </div>
    </div>
  );
}
