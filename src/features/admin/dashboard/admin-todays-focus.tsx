import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import {
  loadAdminActionItems,
  type AdminFocusUrgency,
} from "./load-admin-action-items";

function plural(
  count: number,
  noun: { one: string; other: string },
): string {
  return count === 1 ? noun.one : noun.other;
}

function urgencyStatus(urgency: AdminFocusUrgency): {
  kind: StatusKind;
  label: string;
} {
  switch (urgency) {
    case "action_needed":
      return { kind: "expired", label: "Action needed" };
    case "needs_attention":
      return { kind: "needs_attention", label: "Needs attention" };
    case "pending":
      return { kind: "pending", label: "Pending" };
  }
}

/**
 * @deprecated Prefer AdminTodaysBrief on Admin Home.
 * Compact priority list — actionable items only.
 */
export async function AdminTodaysFocus({ role }: { role: Role }) {
  const { items, error } = await loadAdminActionItems(role);

  return (
    <section
      aria-labelledby="admin-todays-focus-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-todays-focus-heading"
        title="Today's Focus"
      />

      {error ? (
        <p className="ns-muted" role="status">
          Some priorities could not be loaded right now.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div
          role="status"
          className="text-muted-foreground flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3"
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
            {items.map((item) => {
              const tone = urgencyStatus(item.urgency);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-row-hover group flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="ns-meta block">{item.category}</span>
                      <span className="text-heading mt-0.5 block text-sm font-medium leading-snug">
                        {item.label}
                      </span>
                      <span className="ns-meta mt-0.5 flex flex-wrap items-center gap-2">
                        <span>
                          {item.count} {plural(item.count, item.countNoun)}
                        </span>
                        <StatusBadge
                          status={tone.kind}
                          label={tone.label}
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
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
