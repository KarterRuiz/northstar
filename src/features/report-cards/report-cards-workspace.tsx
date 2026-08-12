import { loadReportCardsForStudent } from "@/features/report-cards/load-report-cards-for-student";
import { ReportCardFilesList } from "@/features/report-cards/report-card-files-list";
import { ReportCardUploadSheet } from "@/features/report-cards/report-card-upload-sheet";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";
import { canManageReportCardLifecycle, canUploadReportCards } from "@/config/roles";

export async function ReportCardsWorkspace({
  role,
  studentId,
  intro,
  studentLabel,
  showFileList = true,
}: {
  role: Role;
  studentId: string;
  intro?: string | null;
  studentLabel?: string;
  showFileList?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return (
      <p className="ns-muted text-sm">
        Report cards are unavailable right now.
      </p>
    );
  }

  const [listResult, yearsRes, studentRes] = await Promise.all([
    showFileList
      ? loadReportCardsForStudent(supabase, studentId)
      : Promise.resolve({ items: [], listError: null }),
    supabase
      .from("school_years")
      .select("label")
      .is("archived_at", null)
      .order("starts_on", { ascending: false }),
    studentLabel
      ? Promise.resolve({ data: null })
      : supabase
          .from("students")
          .select("first_name, last_name, preferred_name")
          .eq("id", studentId)
          .maybeSingle(),
  ]);
  const { items, listError } = listResult;

  const showLifecycle = canManageReportCardLifecycle(role);
  const showUpload = canUploadReportCards(role);
  const yearOptions = (yearsRes.data ?? [])
    .map((y) => y.label?.trim())
    .filter((label): label is string => Boolean(label));

  const resolvedLabel =
    studentLabel?.trim() ||
    (studentRes.data
      ? studentRes.data.preferred_name?.trim() ||
        `${studentRes.data.first_name} ${studentRes.data.last_name}`.trim()
      : undefined);

  return (
    <div className="space-y-6">
      {intro ? <p className="ns-muted max-w-2xl">{intro}</p> : null}

      {showUpload ? (
        <div className="flex justify-end">
          <ReportCardUploadSheet
            dashboardRole={role}
            studentId={studentId}
            studentLabel={resolvedLabel}
            suggestedSchoolYears={yearOptions}
          />
        </div>
      ) : null}

      {showFileList ? (
        <ReportCardFilesList
          items={items}
          listError={listError}
          dashboardRole={role}
          showLifecycleControls={showLifecycle}
        />
      ) : null}
    </div>
  );
}
