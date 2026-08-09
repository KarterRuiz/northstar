import { ClipboardList, MessageSquare, Target } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  STAFF_GROWTH_ARCHITECTURE,
  STAFF_OBSERVATIONS_ARCHITECTURE,
} from "@/features/staff-profile/architecture-notes";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";

export function StaffProfessionalNotesTab() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-1">
        <h2 className="ns-section-title">Professional notes</h2>
        <p className="ns-muted">
          Observations, leadership feedback, and professional growth in one place —
          only when records exist.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Observations</CardTitle>
            <CardDescription>
              Date, observer, type, status, summary, and follow-up when modeled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileEmptyState
              icon={ClipboardList}
              title="No observations yet"
              description={STAFF_OBSERVATIONS_ARCHITECTURE}
            />
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Feedback &amp; notes</CardTitle>
            <CardDescription>
              Leadership notes, coaching notes, and follow-ups with visibility when
              supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileEmptyState
              icon={MessageSquare}
              title="No feedback recorded"
              description="Leadership and coaching notes will appear here once a professional feedback table is added."
            />
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardHeader>
            <CardTitle className="ns-card-title">Professional growth</CardTitle>
            <CardDescription>
              Goals, PD/training, and coaching follow-ups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileEmptyState
              icon={Target}
              title="No growth records yet"
              description={STAFF_GROWTH_ARCHITECTURE}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
