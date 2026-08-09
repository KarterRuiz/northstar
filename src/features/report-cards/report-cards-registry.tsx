import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/config/roles";

import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYearLabel } from "@/lib/school-years/current-school-year";
import { ReportCardRegistryFilters } from "@/features/report-cards/report-card-registry-filters";
import { ReportCardRegistryTable } from "@/features/report-cards/report-card-registry-table";
import {
  loadActiveClassesForRegistry,
  loadReportCardsRegistry,
} from "@/features/report-cards/load-report-cards-registry";

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
      <p className="text-muted-foreground text-sm">
        Configure Supabase to search the report card library.
      </p>
    );
  }

  const currentYearRes = await loadCurrentSchoolYearLabel(supabase);
  if (!currentYearRes.ok) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {currentYearRes.error}
      </p>
    );
  }

  const yearFromQuery = spGet(searchParams, "year");
  const defaults = {
    year: yearFromQuery || currentYearRes.label || "",
    term: spGet(searchParams, "term"),
    status: spGet(searchParams, "status"),
    classId: spGet(searchParams, "class"),
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
    supabase.from("school_years").select("label").order("starts_on", { ascending: false }),
  ]);

  if (yearsRes.error) {
    logServerError("report-cards.registry.schoolYears", yearsRes.error.message);
  }

  const yearOptions = yearsRes.error
    ? []
    : (yearsRes.data?.map((y) => y.label) ?? []);
  const listErr =
    registry.error ??
    classes.error ??
    (yearsRes.error ? GENERIC_INFORMATION_LOAD_ERROR : null);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Library search</h2>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Filter by year, class, student, or status. Downloads use short-lived signed
          URLs and are audited.
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
          {listErr}
        </p>
      ) : null}
      <ReportCardRegistryTable rows={registry.items} dashboardRole={role} />
    </section>
  );
}
