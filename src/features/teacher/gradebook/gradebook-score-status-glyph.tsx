"use client";

import { AlertCircle, Ban, CalendarOff, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ScoreStatus } from "./calculations";

const GLYPH = "size-3.5 shrink-0";

export function GradebookScoreStatusGlyph({
  status,
  className,
}: {
  status: ScoreStatus;
  className?: string;
}) {
  switch (status) {
    case "scored":
      return (
        <CheckCircle2
          className={cn(GLYPH, "text-emerald-600 dark:text-emerald-400", className)}
          aria-hidden
        />
      );
    case "missing":
      return (
        <AlertCircle
          className={cn(GLYPH, "text-amber-600 dark:text-amber-400", className)}
          aria-hidden
        />
      );
    case "exempt":
      return (
        <Ban className={cn(GLYPH, "text-muted-foreground", className)} aria-hidden />
      );
    case "absent":
      return (
        <CalendarOff
          className={cn(GLYPH, "text-sky-600 dark:text-sky-400", className)}
          aria-hidden
        />
      );
    default:
      return null;
  }
}
