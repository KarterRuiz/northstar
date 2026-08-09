import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ProfileEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One short sentence */
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * Inline empty state for profile tabs / nested panels.
 * Pattern: icon → short headline → one sentence → optional action.
 */
export function ProfileEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: ProfileEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-xl border border-dashed p-4 shadow-xs sm:flex-row sm:items-start sm:gap-4",
        className,
      )}
    >
      {Icon ? (
        <div
          className="bg-surface-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border border-border"
          aria-hidden
        >
          <Icon className="size-5 stroke-[1.5]" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-heading text-base font-semibold leading-snug tracking-tight">
          {title}
        </p>
        <div className="ns-muted">{description}</div>
        {action ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div>
        ) : null}
      </div>
    </div>
  );
}
