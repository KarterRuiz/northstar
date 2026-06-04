import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  attendanceTrendGlyphs,
  attendanceTrendLabels,
  type AttendanceTrendResult,
} from "./attendance-trend";

type AttendanceTrendBadgeProps = {
  trend: AttendanceTrendResult;
  className?: string;
};

export function AttendanceTrendBadge({ trend, className }: AttendanceTrendBadgeProps) {
  if (!trend) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-muted-foreground gap-1 border-border/80 font-normal tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{attendanceTrendGlyphs[trend]}</span>
      {attendanceTrendLabels[trend]}
    </Badge>
  );
}
