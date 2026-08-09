import type { ReactNode } from "react";

import { personInitials } from "@/lib/people/person-initials";
import { cn } from "@/lib/utils";

type DirectoryPeopleCellProps = {
  name: string;
  /** Secondary line (student #, email, setup note). */
  meta?: ReactNode;
  className?: string;
  /** Soften the initials chip when the record is incomplete / inactive. */
  muted?: boolean;
};

/** People-record cell: subtle initials + name + meta. Consumes shared tokens only. */
export function DirectoryPeopleCell({
  name,
  meta,
  className,
  muted = false,
}: DirectoryPeopleCellProps) {
  return (
    <div className={cn("relative z-[2] flex min-w-0 items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide",
          muted
            ? "bg-muted/70 text-muted-foreground/80"
            : "bg-primary/10 text-primary",
        )}
      >
        {personInitials(name)}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground truncate text-sm font-medium leading-tight">
          {name}
        </p>
        {meta ? <div className="ns-meta truncate">{meta}</div> : null}
      </div>
    </div>
  );
}
