import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";

import { ADMIN_QUICK_ACTIONS } from "./constants";

function workspacePath(role: Role, path: string): string {
  return `/dashboard/${role}${path.startsWith("/") ? path : `/${path}`}`;
}

const PRIMARY_COUNT = 5;

/**
 * @deprecated Prefer AdminQuickAccess workspace cards on Admin Home.
 * Compact routing shortcuts into existing management workspaces — no embedded forms.
 */
export function AdminQuickActions({ role }: { role: Role }) {
  const primary = ADMIN_QUICK_ACTIONS.slice(0, PRIMARY_COUNT);
  const overflow = ADMIN_QUICK_ACTIONS.slice(PRIMARY_COUNT);

  return (
    <section
      aria-labelledby="admin-quick-actions-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-quick-actions-heading"
        title="Quick Actions"
      />
      <div className="flex flex-wrap items-center gap-2">
        {primary.map((action) => (
          <Button
            key={action.id}
            asChild
            variant={action.primary ? "default" : "outline"}
            size="sm"
          >
            <Link href={workspacePath(role, action.path)}>{action.label}</Link>
          </Button>
        ))}
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="More actions">
                More
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {overflow.map((action) => (
                <DropdownMenuItem key={action.id} asChild>
                  <Link href={workspacePath(role, action.path)}>
                    {action.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </section>
  );
}
