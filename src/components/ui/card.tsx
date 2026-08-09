import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "bg-card text-card-foreground border-border rounded-xl border transition-[box-shadow,transform,border-color,background-color] duration-150 ease-out",
  {
    variants: {
      variant: {
        /** Primary content panel — white, light border, soft shadow */
        default: "shadow-sm",
        /** KPI / signal metrics */
        metric: "shadow-sm",
        /** Nested or dense panels — tighter radius, lighter elevation */
        compact: "rounded-lg shadow-xs",
        /** Flat inset surface (filters, nested groups) — secondary #F8FAFC */
        muted: "bg-surface-muted border-transparent shadow-none",
        /** Table / list wrapper — clip overflow for row hover */
        table: "shadow-sm overflow-hidden p-0",
        /** Form / settings section with tinted panel feel */
        form: "bg-surface-muted border-border shadow-none",
        /** Interactive clickable panel — lift 2px + stronger shadow */
        interactive:
          "shadow-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

const cardHeaderVariants = cva("flex flex-col", {
  variants: {
    density: {
      /** Less padding INSIDE cards */
      default: "gap-1 p-3.5 sm:p-4",
      compact: "gap-0.5 p-3 sm:p-3.5",
      metric: "gap-1 p-3 sm:p-3.5",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

function CardHeader({
  className,
  density,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardHeaderVariants>) {
  return (
    <div
      className={cn(cardHeaderVariants({ density }), className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("ns-card-title leading-snug", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("ns-muted", className)}
      {...props}
    />
  );
}

const cardContentVariants = cva("", {
  variants: {
    density: {
      default: "p-3.5 pt-0 sm:p-4 sm:pt-0",
      compact: "p-3 pt-0 sm:p-3.5 sm:pt-0",
      metric: "p-3 pt-0 sm:p-3.5 sm:pt-0",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

function CardContent({
  className,
  density,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardContentVariants>) {
  return (
    <div
      className={cn(cardContentVariants({ density }), className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center p-3.5 pt-0 sm:p-4 sm:pt-0", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
