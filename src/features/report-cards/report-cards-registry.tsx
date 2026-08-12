import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";

import { loadCurrentSchoolYearLabel } from "@/lib/school-years/current-school-year";
import { ReportCardRegistryFilters } from "@/features/report-cards/report-card-registry-filters";
import { ReportCardRegistryTable } from "@/features/report-cards/report-card-registry-table";
import {
  loadActiveClassesForRegistry,
  loadReportCardsRegistry,
  REPORT_CARD_LIBRARY_LOAD_ERROR,
} from "@/features/report-cards/load-report-cards-registry";
import { pickReportCardsClassId } from "@/features/report-cards/load-report-cards-command-center";

function spGet(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export async function ReportCardRegistrySection({
  role,
  searchParams,
}: {
  role: Role;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return (
      <p className="ns-muted text-sm">
        Report cards are unavailable right now.
      </p>
    );
  }

  const currentYearRes = await loadCurrentSchoolYearLabel(supabase);
  const yearFromQuery = spGet(searchParams, "year");
  const classFromQuery = pickReportCardsClassId(searchParams) ?? "";
  const defaults = {
    year: yearFromQuery || (currentYearRes.ok ? currentYearRes.label : "") || "",
    term: spGet(searchParams, "term"),
    status: spGet(searchParams, "status"),
    classId: classFromQuery || spGet(searchParams, "class"),
    q: spGet(searchParams, "q"),
  };

  const [registry, classes, yearsRes] = await Promise.all([
    loadReportCardsRegistry(supabase, {
      schoolYear: defaults.year || null,
      term: defaults.term || null,
      status: defaults.status || null,
      classId: defaults.classId || null,
      q: defaults.q || null,
    }),
    loadActiveClassesForRegistry(supabase),
    supabase
      .from("school_years")
      .select("label")
      .order("starts_on", { ascending: false }),
  ]);

  const yearOptions = yearsRes.error
    ? []
    : (yearsRes.data?.map((y) => y.label).filter(Boolean) ?? []);
  const listErr = registry.error ?? classes.error;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-heading text-base font-semibold tracking-tight">
          Report library
        </h2>
        <p className="ns-muted max-w-2xl">
          Find completed and draft report cards by year, term, class, or student.
        </p>
      </div>
      <ReportCardRegistryFilters
        role={role}
        defaults={defaults}
        classOptions={classes.options}
        yearOptions={yearOptions}
      />
      {listErr ? (
        <p className="text-destructive text-sm" role="alert">
          {listErr || REPORT_CARD_LIBRARY_LOAD_ERROR}
        </p>
      ) : null}
      <ReportCardRegistryTable rows={registry.items} dashboardRole={role} />
    </section>
  );
}
