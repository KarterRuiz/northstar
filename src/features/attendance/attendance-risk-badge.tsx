"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  attendanceRiskTierClassName,
  attendanceRiskTierLabels,
  type AttendanceRiskTier,
} from "./attendance-risk-tier";

type AttendanceRiskBadgeProps = {
  tier: AttendanceRiskTier;
  className?: string;
};

export function AttendanceRiskBadge({ tier, className }: AttendanceRiskBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        attendanceRiskTierClassName(tier),
        className,
      )}
    >
      {attendanceRiskTierLabels[tier]}
    </Badge>
  );
}
