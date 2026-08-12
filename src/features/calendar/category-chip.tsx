import { cn } from "@/lib/utils";

import { EVENT_CATEGORY_LABELS } from "./constants";
import type { EventCategory } from "./types";

const CATEGORY_TONE: Record<EventCategory, string> = {
  school: "bg-muted text-heading",
  meeting: "bg-muted text-heading",
  academic: "bg-info/10 text-info",
  reporting: "bg-warning/10 text-warning-foreground",
  pd: "bg-muted text-heading",
  event: "bg-success/10 text-success",
  deadline: "bg-destructive/10 text-destructive",
};

const CATEGORY_DOT: Record<EventCategory, string> = {
  school: "bg-heading",
  meeting: "bg-muted-foreground",
  academic: "bg-info",
  reporting: "bg-warning",
  pd: "bg-heading/60",
  event: "bg-success",
  deadline: "bg-destructive",
};

export function categoryDotClass(category: EventCategory): string {
  return CATEGORY_DOT[category];
}

export function CategoryChip({
  category,
  className,
}: {
  category: EventCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        CATEGORY_TONE[category],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", CATEGORY_DOT[category])} aria-hidden />
      {EVENT_CATEGORY_LABELS[category]}
    </span>
  );
}
