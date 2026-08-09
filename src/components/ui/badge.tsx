import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status / label chips — prefer semantic variants over ad-hoc color classes.
 * For product statuses, prefer StatusBadge when a known status applies.
 * Refined: small, muted semantic fills — not decorative color blocks.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-foreground",
        /** Muted red — Expired / Error / Action needed */
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive",
        /** Muted green — Healthy / Active */
        success:
          "border-success/20 bg-success/10 text-success",
        /** Soft amber — Needs attention / Pending */
        warning:
          "border-warning/25 bg-warning/10 text-warning-foreground",
        info: "border-info/20 bg-info/10 text-info",
        /** Neutral gray — Archived / Inactive */
        muted:
          "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
