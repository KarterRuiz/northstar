import { FolderOpen, ClipboardList } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { STAFF_FILES_ARCHITECTURE } from "@/features/staff-profile/architecture-notes";
import type { StaffActivityItem } from "@/features/staff-profile/load-staff-activity";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";

type StaffFilesActivityTabProps = {
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

export function StaffFilesActivityTab({
  items,
  error,
}: StaffFilesActivityTabProps) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Files</h2>
          <p className="ns-muted">
            Staff documents when storage is provisioned — separate from student files.
          </p>
        </div>
        <ProfileEmptyState
          icon={FolderOpen}
          title="No staff files yet"
          description={STAFF_FILES_ARCHITECTURE}
        />
      </section>

      <div className="border-border/70 border-t" />

      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Activity</h2>
          <p className="ns-muted">
            Audit trail for this professional record — only real events with timestamps.
          </p>
        </div>

        {error ? (
          <p className="ns-muted" role="status">
            Activity is temporarily unavailable.
          </p>
        ) : items.length === 0 ? (
          <ProfileEmptyState
            icon={ClipboardList}
            title="No activity yet"
            description="Leadership actions for this staff member will appear here when recorded."
          />
        ) : (
          <Card variant="table">
            <CardHeader>
              <CardTitle className="ns-card-title">Events</CardTitle>
              <CardDescription>Newest first.</CardDescription>
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
        )}
      </section>
    </div>
  );
}
