import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ProfileEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: ReactNode;
  className?: string;
};

export function ProfileEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: ProfileEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-muted-foreground/20 bg-muted/25 text-muted-foreground flex flex-col gap-3 rounded-lg border border-dashed p-5 sm:flex-row sm:items-start sm:gap-4",
        className,
      )}
    >
      {Icon ? (
        <div
          className="bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border shadow-sm"
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="min-w-0 space-y-1.5">
        <p className="text-foreground text-sm font-medium leading-snug">{title}</p>
        <div className="text-sm leading-relaxed">{description}</div>
      </div>
    </div>
  );
}
