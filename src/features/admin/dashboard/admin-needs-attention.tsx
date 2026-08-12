import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import { loadAdminActionItems } from "./load-admin-action-items";

function plural(
  count: number,
  noun: { one: string; other: string },
): string {
  return count === 1 ? noun.one : noun.other;
}

/**
 * @deprecated Prefer AdminTodaysBrief — kept for reference / gradual cleanup.
 */
export async function AdminNeedsAttention({
  role = "admin",
}: {
  role?: Role;
}) {
  const { items, error } = await loadAdminActionItems(role);

  return (
    <section
      aria-labelledby="admin-needs-attention-heading"
      className="space-y-3"
    >
      <WorkspaceSectionHeader
        id="admin-needs-attention-heading"
        eyebrow="Today"
        title="Needs attention"
      />

      {error ? (
        <p className="ns-muted" role="status">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2.5 py-1"
        >
          <CheckCircle2
            className="text-success size-4 shrink-0"
            aria-hidden
          />
          <p className="ns-body">No urgent follow-up right now.</p>
        </div>
      ) : (
        <Card variant="table">
          <ul className="divide-border divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="hover:bg-row-hover group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="text-heading block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="ns-meta mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        {item.count} {plural(item.count, item.countNoun)}
                      </span>
                      <StatusBadge
                        status={
                          item.urgency === "action_needed"
                            ? "expired"
                            : item.urgency === "pending"
                              ? "pending"
                              : "needs_attention"
                        }
                        className="text-[10px]"
                      />
                    </span>
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
