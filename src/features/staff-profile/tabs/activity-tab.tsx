import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";
import type { StaffActivityItem } from "@/features/staff-profile/load-staff-activity";
import { ClipboardList } from "lucide-react";

type StaffActivityTabProps = {
  items: StaffActivityItem[];
  error: string | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StaffActivityTab({ items, error }: StaffActivityTabProps) {
  if (error) {
    return (
      <p className="ns-muted" role="status">
        Activity is temporarily unavailable.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <ProfileEmptyState
        icon={ClipboardList}
        title="No activity yet"
        description="Only real audit events with timestamps for this staff member are shown — nothing is fabricated."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="ns-section-title">Activity</h2>
        <p className="ns-muted">Audit trail for this professional record.</p>
      </div>
      <Card variant="table">
        <CardHeader>
          <CardTitle className="ns-card-title">Events</CardTitle>
          <CardDescription>Newest first from audit_events.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-border divide-y">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="text-heading text-sm font-medium">{item.summary}</p>
                <p className="ns-meta mt-0.5">
                  {formatWhen(item.occurredAt)}
                  {item.actorLabel ? ` · ${item.actorLabel}` : null}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
