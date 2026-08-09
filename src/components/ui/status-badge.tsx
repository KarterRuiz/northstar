import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Canonical product statuses for NorthStar UI.
 * Prefer this over ad-hoc badge colors on admin/directory surfaces.
 *
 * Healthy/Active → muted green · Needs attention → muted amber ·
 * Archived/Inactive → neutral gray · Expired/Error → muted red · Not started → gray
 */
export const STATUS_KINDS = [
  "active",
  "healthy",
  "pending",
  "needs_attention",
  "archived",
  "inactive",
  "expired",
  "not_started",
] as const;

export type StatusKind = (typeof STATUS_KINDS)[number];

const LABEL_BY_KIND: Record<StatusKind, string> = {
  active: "Active",
  healthy: "Healthy",
  pending: "Pending",
  needs_attention: "Needs attention",
  archived: "Archived",
  inactive: "Inactive",
  expired: "Expired",
  not_started: "Not started",
};

const VARIANT_BY_KIND: Record<StatusKind, NonNullable<BadgeProps["variant"]>> = {
  active: "success",
  healthy: "success",
  pending: "warning",
  needs_attention: "warning",
  archived: "muted",
  inactive: "muted",
  expired: "destructive",
  not_started: "muted",
};

export function statusKindLabel(kind: StatusKind): string {
  return LABEL_BY_KIND[kind];
}

export function statusKindVariant(
  kind: StatusKind,
): NonNullable<BadgeProps["variant"]> {
  return VARIANT_BY_KIND[kind];
}

type StatusBadgeProps = Omit<BadgeProps, "variant" | "children"> & {
  status: StatusKind;
  /** Override default label */
  label?: string;
};

export function StatusBadge({
  status,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant={VARIANT_BY_KIND[status]}
      className={cn("whitespace-nowrap shadow-none", className)}
      {...props}
    >
      {label ?? LABEL_BY_KIND[status]}
    </Badge>
  );
}
