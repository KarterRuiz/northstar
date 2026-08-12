import Link from "next/link";

import { Card } from "@/components/ui/card";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";
import type { Role } from "@/config/roles";
import { cn } from "@/lib/utils";

import {
  FOLLOW_UP_CATEGORY_LABELS,
  FOLLOW_UP_EMPTY,
  FOLLOW_UP_PARTIAL_LOAD,
  FOLLOW_UP_TAB_LABELS,
} from "./constants";
import { todayForFollowUp } from "./classify";
import { FollowUpFormSheet } from "./follow-up-form-sheet";
import { FollowUpRow } from "./follow-up-row";
import type { FollowUpWorkspaceData } from "./load-follow-up-workspace";
import type { FollowUpCategory, FollowUpTab } from "./types";

const TABS: FollowUpTab[] = ["my-day", "upcoming", "waiting", "completed"];

const FILTERS: { id: "all" | FollowUpCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "students", label: "Students" },
  { id: "staff", label: "Staff" },
  { id: "families", label: "Families" },
  { id: "records", label: "Records" },
  { id: "classes", label: "Classes" },
];

function hrefFor(
  role: Role,
  tab: FollowUpTab,
  category: "all" | FollowUpCategory,
  page?: number,
) {
  const params = new URLSearchParams();
  if (tab !== "my-day") params.set("tab", tab);
  if (category !== "all") params.set("category", category);
  if (page && page > 1) params.set("page", String(page));
  const q = params.toString();
  return `/dashboard/${role}/follow-up${q ? `?${q}` : ""}`;
}

export function FollowUpWorkspace({
  role,
  data,
}: {
  role: Role;
  data: FollowUpWorkspaceData;
}) {
  const today = todayForFollowUp();
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const emptyCopy =
    data.category !== "all" && data.items.length === 0
      ? `Nothing in ${FOLLOW_UP_CATEGORY_LABELS[data.category]} right now.`
      : FOLLOW_UP_EMPTY[data.tab];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
      <WorkspacePageHeader
        className="gap-3 sm:gap-6"
        eyebrow={siteConfig.shortName}
        title="Follow-Up"
        description="Things worth coming back to."
        actions={<FollowUpFormSheet />}
      />

      <div className="flex flex-wrap items-center gap-1" aria-label="Follow-up summary">
        <SummaryLink
          href={hrefFor(role, "my-day", data.category)}
          label="Today"
          value={data.counts.today}
          active={data.tab === "my-day"}
        />
        <SummaryLink
          href={hrefFor(role, "upcoming", data.category)}
          label="Upcoming"
          value={data.counts.upcoming}
          active={data.tab === "upcoming"}
        />
        <SummaryLink
          href={hrefFor(role, "waiting", data.category)}
          label="Waiting"
          value={data.counts.waiting}
          active={data.tab === "waiting"}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1" aria-label="Follow-up views">
          {TABS.map((tab) => (
            <Link
              key={tab}
              href={hrefFor(role, tab, data.category)}
              aria-current={data.tab === tab ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                data.tab === tab
                  ? "bg-heading text-primary-foreground"
                  : "text-muted-foreground hover:bg-row-hover hover:text-heading",
              )}
            >
              {FOLLOW_UP_TAB_LABELS[tab]}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-1" aria-label="Category">
          {FILTERS.map((filter) => (
            <Link
              key={filter.id}
              href={hrefFor(role, data.tab, filter.id)}
              aria-current={data.category === filter.id ? "true" : undefined}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                data.category === filter.id
                  ? "border-heading/30 bg-muted text-heading"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-heading",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {data.error ? (
        <p className="ns-muted" role="status">
          {FOLLOW_UP_PARTIAL_LOAD}
        </p>
      ) : null}

      {data.items.length === 0 ? (
        <Card className="px-5 py-8 text-center">
          <p className="text-heading text-sm font-medium">{emptyCopy}</p>
          {data.tab === "my-day" && data.category === "all" ? (
            <div className="mt-3 flex justify-center">
              <FollowUpFormSheet triggerVariant="outline" />
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {data.items.map((item) => (
              <FollowUpRow key={item.id} item={item} today={today} />
            ))}
          </ul>
        </Card>
      )}

      {pageCount > 1 ? (
        <nav className="flex justify-end gap-2 text-sm" aria-label="Pagination">
          {data.page > 1 ? (
            <Link
              href={hrefFor(role, data.tab, data.category, data.page - 1)}
              className="text-primary font-medium hover:underline"
            >
              Previous
            </Link>
          ) : null}
          <span className="ns-meta">
            {data.page} / {pageCount}
          </span>
          {data.page < pageCount ? (
            <Link
              href={hrefFor(role, data.tab, data.category, data.page + 1)}
              className="text-primary font-medium hover:underline"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function SummaryLink({
  href,
  label,
  value,
  active,
}: {
  href: string;
  label: string;
  value: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-heading/8 text-heading"
          : "text-muted-foreground hover:bg-row-hover hover:text-heading",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </Link>
  );
}
