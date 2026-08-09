import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DirectoryToolbarProps = {
  children: ReactNode;
  className?: string;
};

/** Compact search-primary filter strip for people directories. */
export function DirectoryToolbar({ children, className }: DirectoryToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b pb-3 sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DirectoryToolbarSearchProps = {
  children: ReactNode;
  className?: string;
};

export function DirectoryToolbarSearch({
  children,
  className,
}: DirectoryToolbarSearchProps) {
  return (
    <div className={cn("min-w-0 flex-1 sm:max-w-sm md:max-w-md", className)}>
      {children}
    </div>
  );
}

type DirectoryToolbarFiltersProps = {
  children: ReactNode;
  className?: string;
};

export function DirectoryToolbarFilters({
  children,
  className,
}: DirectoryToolbarFiltersProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2 sm:shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
