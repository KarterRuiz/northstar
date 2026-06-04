import { loadReportCardsForStudent } from "@/features/report-cards/load-report-cards-for-student";
import { ReportCardFilesList } from "@/features/report-cards/report-card-files-list";
import { ReportCardUploadForm } from "@/features/report-cards/report-card-upload-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";
import { canManageReportCardLifecycle } from "@/config/roles";

function suggestedSchoolYears(): string[] {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const start = y - 1 - i;
    out.push(`${start}-${start + 1}`);
  }
  return out;
}

export async function ReportCardsWorkspace({
  role,
  studentId,
  intro,
}: {
  role: Role;
  studentId: string;
  intro?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return (
      <p className="text-muted-foreground text-sm">
        Add{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
          NEXT_PUBLIC_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        to load and upload report cards.
      </p>
    );
  }

  const { items, listError } = await loadReportCardsForStudent(
    supabase,
    studentId,
  );
  const schoolYears = suggestedSchoolYears();
  const showLifecycle = canManageReportCardLifecycle(role);

  return (
    <div className="space-y-8">
      {intro ? (
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {intro}
        </p>
      ) : null}

      <ReportCardUploadForm dashboardRole={role} studentId={studentId} suggestedSchoolYears={schoolYears} />

      <ReportCardFilesList
        items={items}
        listError={listError}
        dashboardRole={role}
        showLifecycleControls={showLifecycle}
      />
    </div>
  );
}
