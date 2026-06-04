import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ListEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: ReactNode;
  className?: string;
};

export function ListEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: ListEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-muted/80 bg-muted/15 text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed px-5 py-9 text-center sm:px-8 sm:py-10",
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="text-muted-foreground/70 mb-3 size-9 shrink-0 stroke-[1.35] sm:size-10"
          aria-hidden
        />
      ) : null}
      <p className="text-foreground text-sm font-medium">{title}</p>
      <div className="mt-1.5 max-w-md text-sm leading-relaxed">{description}</div>
    </div>
  );
}
