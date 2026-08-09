import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DirectoryClickableRowProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof TableRow>, "children" | "className" | "clickable">;

/** Row chrome for navigable directory records (shared TableRow `clickable`). */
export function DirectoryClickableRow({
  children,
  className,
  ...props
}: DirectoryClickableRowProps) {
  return (
    <TableRow clickable className={cn("relative", className)} {...props}>
      {children}
    </TableRow>
  );
}

type DirectoryRowHitTargetProps = {
  href: string;
  label: string;
};

/**
 * Stretch link for the whole row. Place as the first child of the first cell;
 * positions against the relative row. Keep other interactive controls at `z-10`.
 */
export function DirectoryRowHitTarget({ href, label }: DirectoryRowHitTargetProps) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring absolute inset-0 z-[1] rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </Link>
  );
}
