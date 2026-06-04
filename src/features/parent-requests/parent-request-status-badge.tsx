import { Badge } from "@/components/ui/badge";

import {
  type ParentRequestStatus,
  parentRequestStatusLabel,
} from "./constants";

const VARIANT_BY_STATUS: Record<
  ParentRequestStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  received: "secondary",
  approved: "default",
  completed: "outline",
  denied: "destructive",
};

export function ParentRequestStatusBadge({
  status,
}: {
  status: ParentRequestStatus | string;
}) {
  const key: ParentRequestStatus =
    status === "received" ||
    status === "approved" ||
    status === "completed" ||
    status === "denied"
      ? status
      : "received";
  const variant = VARIANT_BY_STATUS[key];
  const label =
    status === "received" ||
    status === "approved" ||
    status === "completed" ||
    status === "denied"
      ? parentRequestStatusLabel(key)
      : status;

  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  );
}
