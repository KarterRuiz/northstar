import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ListEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One short sentence — avoid gray walls of helper copy */
  description: ReactNode;
  /** Optional primary action (Button asChild / Link) */
  action?: ReactNode;
  className?: string;
};

/**
 * Centered empty list / directory state.
 * Pattern: icon → short headline → one sentence → optional action.
 */
export function ListEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: ListEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center shadow-xs sm:px-8 sm:py-10",
        className,
      )}
    >
      {Icon ? (
        <div
          className="bg-surface-muted text-muted-foreground mb-3 flex size-11 items-center justify-center rounded-lg border border-border"
          aria-hidden
        >
          <Icon className="size-5 stroke-[1.5]" />
        </div>
      ) : null}
      <p className="text-heading text-base font-semibold tracking-tight">
        {title}
      </p>
      <div className="ns-muted mt-1.5 max-w-sm">{description}</div>
      {action ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
