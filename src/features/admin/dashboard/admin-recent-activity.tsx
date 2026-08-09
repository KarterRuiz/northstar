import Link from "next/link";
import { Activity } from "lucide-react";

import { Card } from "@/components/ui/card";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { loadAdminRecentActivity } from "./load-admin-recent-activity";

function formatRelativeWhen(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;

  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export async function AdminRecentActivity() {
  const { items, error } = await loadAdminRecentActivity();

  return (
    <section
      aria-labelledby="admin-recent-activity-heading"
      className="space-y-3"
    >
      <WorkspaceSectionHeader
        id="admin-recent-activity-heading"
        eyebrow="Activity"
        title="Recent activity"
      />

      {error ? (
        <p className="ns-muted" role="status">
          Recent activity could not be loaded right now.
        </p>
      ) : null}

      {!error && items.length === 0 ? (
        <ListEmptyState
          icon={Activity}
          title="No recent activity yet"
          description="Notes, invites, parent requests, and report cards will appear here as they happen."
          className="py-8 sm:py-9"
        />
      ) : null}

      {items.length > 0 ? (
        <Card variant="table">
          <ul className="divide-border divide-y">
            {items.map((item) => {
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="text-heading block text-sm leading-snug">
                      {item.summary}
                    </span>
                    {item.actorLabel ? (
                      <span className="ns-meta mt-0.5 block">
                        {item.actorLabel}
                      </span>
                    ) : null}
                  </span>
                  <time
                    dateTime={item.occurredAt}
                    className="ns-meta shrink-0"
                    title={new Date(item.occurredAt).toLocaleString()}
                  >
                    {formatRelativeWhen(item.occurredAt)}
                  </time>
                </>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="hover:bg-row-hover flex items-start justify-between gap-3 px-4 py-2.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
