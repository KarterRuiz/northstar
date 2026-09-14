"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { createSchoolYearAction } from "@/features/school-settings/school-year-actions";
import { cn } from "@/lib/utils";

import {
  YEAR_END_DISPOSITION_LABELS,
  YEAR_END_DISPOSITIONS,
  YEAR_END_STEP_LABELS,
  YEAR_END_STEPS,
  type YearEndDisposition,
  type YearEndStep,
} from "./types";
import type { YearEndWorkspaceData } from "./load-year-end-workspace";
import {
  copyYearEndClassStructureAction,
  createOrOpenYearEndPlanAction,
  ensureYearEndNextYearTermsAction,
  markYearEndPlanReadyAction,
  refreshYearEndPlanItemsAction,
  revertYearEndPlanToDraftAction,
  updateYearEndClassMapAction,
  updateYearEndPlanItemAction,
  type YearEndMutationState,
} from "./year-end-actions";

function hrefFor(role: Role, step: YearEndStep, planId?: string | null) {
  const params = new URLSearchParams();
  if (step !== "setup") params.set("step", step);
  if (planId) params.set("plan", planId);
  const q = params.toString();
  return `/dashboard/${role}/year-end${q ? `?${q}` : ""}`;
}

function ActionMessage({ state }: { state: YearEndMutationState | undefined }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p className="text-muted-foreground text-sm" role="status">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p className="text-destructive text-sm" role="alert">
      {state.error}
    </p>
  );
}

export function YearEndWorkspace({
  role,
  data,
}: {
  role: Role;
  data: Extract<YearEndWorkspaceData, { ok: true }>;
}) {
  const planId = data.plan?.id ?? null;

  return (
    <div className="ns-page-shell-wide space-y-6 sm:space-y-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Year-End"
        description="Plan next-year classes and student dispositions. Preview only — placements are not committed in this phase."
        footer={
          data.plan ? (
            <p className="ns-meta">
              Plan: {data.plan.fromLabel} → {data.plan.toLabel} ·{" "}
              <span className="text-foreground font-medium uppercase tracking-wide">
                {data.plan.status}
              </span>
            </p>
          ) : (
            <p className="ns-meta">Create a draft plan to begin class mapping and student review.</p>
          )
        }
      />

      <nav
        className="flex flex-wrap gap-1 border-b border-border/60 pb-2"
        aria-label="Year-end steps"
      >
        {YEAR_END_STEPS.map((step) => {
          const disabled = step !== "setup" && !planId;
          const active = data.step === step;
          if (disabled) {
            return (
              <span
                key={step}
                className="text-muted-foreground/50 cursor-not-allowed rounded-md px-3 py-1.5 text-sm"
              >
                {YEAR_END_STEP_LABELS[step]}
              </span>
            );
          }
          return (
            <Link
              key={step}
              href={hrefFor(role, step, planId)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {YEAR_END_STEP_LABELS[step]}
            </Link>
          );
        })}
      </nav>

      {data.step === "setup" ? <SetupPanel role={role} data={data} /> : null}
      {data.step === "class-map" && data.plan ? (
        <ClassMapPanel role={role} data={data} />
      ) : null}
      {data.step === "students" && data.plan ? (
        <StudentsPanel role={role} data={data} />
      ) : null}
      {data.step === "preview" && data.plan ? <PreviewPanel data={data} /> : null}
    </div>
  );
}

function SetupPanel({
  role,
  data,
}: {
  role: Role;
  data: Extract<YearEndWorkspaceData, { ok: true }>;
}) {
  const router = useRouter();
  const liveYears = data.schoolYears.filter((y) => !y.archived_at);
  const defaultFrom =
    data.plan?.fromSchoolYearId ??
    data.currentYearId ??
    liveYears.find((y) => y.is_current)?.id ??
    liveYears[0]?.id ??
    "";
  const defaultTo =
    data.plan?.toSchoolYearId ??
    liveYears.find((y) => !y.is_current && y.id !== defaultFrom)?.id ??
    "";

  const [planState, planAction, planPending] = useActionState(
    createOrOpenYearEndPlanAction,
    undefined,
  );
  const [yearState, yearAction, yearPending] = useActionState(
    createSchoolYearAction,
    undefined,
  );
  const [termsState, termsAction, termsPending] = useActionState(
    ensureYearEndNextYearTermsAction,
    undefined,
  );

  useEffect(() => {
    if (planState?.ok && planState.planId) {
      router.push(hrefFor(role, "class-map", planState.planId));
    }
  }, [planState, role, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Open or create plan</CardTitle>
          <CardDescription>
            Choose the closing year (usually Current) and the next school year. Draft plans do not
            change student placements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={planAction} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Closing year</span>
              <select
                name="fromSchoolYearId"
                required
                defaultValue={defaultFrom}
                className="border-input bg-background w-full rounded-md border px-3 py-2"
              >
                {liveYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Next year</span>
              <select
                name="toSchoolYearId"
                required
                defaultValue={defaultTo}
                className="border-input bg-background w-full rounded-md border px-3 py-2"
              >
                <option value="">Select next year…</option>
                {liveYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={planPending}>
              {planPending ? "Opening…" : "Open draft plan"}
            </Button>
            <ActionMessage state={planState} />
          </form>

          {data.plans.length > 0 ? (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Existing plans</p>
              <ul className="space-y-1 text-sm">
                {data.plans.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={hrefFor(role, "setup", p.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {p.fromLabel} → {p.toLabel}
                    </Link>{" "}
                    <span className="text-muted-foreground uppercase">{p.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create next school year</CardTitle>
            <CardDescription>
              Uses the same School Settings action. Does not set Current.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={yearAction} className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Label</span>
                <input
                  name="label"
                  required
                  placeholder="2027-2028"
                  className="border-input bg-background w-full rounded-md border px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Starts</span>
                  <input
                    type="date"
                    name="startsOn"
                    required
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Ends</span>
                  <input
                    type="date"
                    name="endsOn"
                    required
                    className="border-input bg-background w-full rounded-md border px-3 py-2"
                  />
                </label>
              </div>
              <Button type="submit" variant="secondary" disabled={yearPending}>
                {yearPending ? "Creating…" : "Create school year"}
              </Button>
              <ActionMessage
                state={
                  yearState
                    ? yearState.ok
                      ? { ok: true, message: yearState.message }
                      : { ok: false, error: yearState.error }
                    : undefined
                }
              />
            </form>
          </CardContent>
        </Card>

        {data.plan ? (
          <Card>
            <CardHeader>
              <CardTitle>Next-year terms</CardTitle>
              <CardDescription>
                Ensure T1–T4 exist for {data.plan.toLabel}. Dates may stay blank.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="ns-meta">
                Present:{" "}
                {data.toYearTermCodes.length > 0
                  ? data.toYearTermCodes.join(", ")
                  : "none"}
                {data.missingToYearTerms.length > 0
                  ? ` · Missing: ${data.missingToYearTerms.join(", ")}`
                  : " · Complete"}
              </p>
              <form action={termsAction}>
                <input type="hidden" name="planId" value={data.plan.id} />
                <Button type="submit" variant="secondary" disabled={termsPending}>
                  {termsPending ? "Creating…" : "Create missing T1–T4"}
                </Button>
              </form>
              <ActionMessage state={termsState} />
              <p className="text-muted-foreground text-sm">
                Next:{" "}
                <Link
                  href={hrefFor(role, "class-map", data.plan.id)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Class Mapping
                </Link>
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ClassMapPanel({
  role,
  data,
}: {
  role: Role;
  data: Extract<YearEndWorkspaceData, { ok: true }>;
}) {
  const plan = data.plan!;
  const [copyState, copyAction, copyPending] = useActionState(
    copyYearEndClassStructureAction,
    undefined,
  );
  const [mapState, mapAction, mapPending] = useActionState(
    updateYearEndClassMapAction,
    undefined,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scaffold next-year classes</CardTitle>
          <CardDescription>
            Copy structure only (name, section, grade). Does not copy students, enrollments,
            attendance, report cards, or gradebook data. Grade 5 sources are skipped when bumping
            grade.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <form action={copyAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="bumpGrade" value="0" />
            <Button type="submit" variant="secondary" disabled={copyPending}>
              Copy same-grade shells
            </Button>
          </form>
          <form action={copyAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="bumpGrade" value="1" />
            <Button type="submit" disabled={copyPending}>
              Copy as next-grade shells
            </Button>
          </form>
          <ActionMessage state={copyState} />
          <p className="text-muted-foreground w-full text-sm">
            Or create classes manually in{" "}
            <Link
              href={`/dashboard/${role}/classes`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Class Management
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Class map</CardTitle>
          <CardDescription>
            Map each closing-year class to a next-year class. Unmapped is allowed (students will need
            overrides). Grade 5 → Graduate Primary uses no destination class.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.classMaps.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No active classes in the closing year.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">From</th>
                    <th className="py-2 pr-3 font-medium">To</th>
                    <th className="py-2 font-medium">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classMaps.map((row) => {
                    const isG5 =
                      (row.fromClass.gradeCode ?? "").toUpperCase() === "G5" ||
                      /^grade\s*5$/i.test(row.fromClass.gradeName);
                    return (
                      <tr key={row.fromClassId} className="border-b border-border/50">
                        <td className="py-2 pr-3 align-middle">
                          {row.fromClass.label}
                          {isG5 ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              (Graduate Primary default)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 align-middle">
                          <form
                            id={`map-${row.fromClassId}`}
                            action={mapAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="fromClassId" value={row.fromClassId} />
                            <select
                              name="toClassId"
                              defaultValue={row.toClassId ?? "__none__"}
                              className="border-input bg-background w-full max-w-xs rounded-md border px-2 py-1.5"
                            >
                              <option value="__none__">— Unmapped —</option>
                              {data.toClasses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </form>
                        </td>
                        <td className="py-2 align-middle">
                          <Button
                            type="submit"
                            form={`map-${row.fromClassId}`}
                            size="sm"
                            variant="secondary"
                            disabled={mapPending}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ActionMessage state={mapState} />
          <p className="text-sm">
            Next:{" "}
            <Link
              href={hrefFor(role, "students", plan.id)}
              className="text-primary underline-offset-4 hover:underline"
            >
              Student Review
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentsPanel({
  role,
  data,
}: {
  role: Role;
  data: Extract<YearEndWorkspaceData, { ok: true }>;
}) {
  const plan = data.plan!;
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshYearEndPlanItemsAction,
    undefined,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Student dispositions</CardTitle>
            <CardDescription>
              Operationally active students in the closing year. Defaults: G1–G4 Promote, G5 Graduate
              Primary. Refresh is idempotent and preserves overrides.
            </CardDescription>
          </div>
          <form action={refreshAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <Button type="submit" disabled={refreshPending}>
              {refreshPending ? "Refreshing…" : "Refresh student plan"}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionMessage state={refreshState} />
          {data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No plan items yet. Click Refresh student plan after class mapping.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Student</th>
                    <th className="py-2 pr-2 font-medium">Number</th>
                    <th className="py-2 pr-2 font-medium">From</th>
                    <th className="py-2 pr-2 font-medium">Disposition</th>
                    <th className="py-2 pr-2 font-medium">Destination</th>
                    <th className="py-2 pr-2 font-medium">Reason</th>
                    <th className="py-2 font-medium">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <StudentItemRow
                      key={item.id}
                      planId={plan.id}
                      item={item}
                      toClasses={data.toClasses}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm">
            Next:{" "}
            <Link
              href={hrefFor(role, "preview", plan.id)}
              className="text-primary underline-offset-4 hover:underline"
            >
              Preview
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentItemRow({
  planId,
  item,
  toClasses,
}: {
  planId: string;
  item: Extract<YearEndWorkspaceData, { ok: true }>["items"][number];
  toClasses: Extract<YearEndWorkspaceData, { ok: true }>["toClasses"];
}) {
  const [disposition, setDisposition] = useState<YearEndDisposition>(item.disposition);
  const [state, action, pending] = useActionState(updateYearEndPlanItemAction, undefined);
  const needsDest =
    disposition === "promote" ||
    disposition === "retain" ||
    disposition === "remap" ||
    disposition === "custom";

  return (
    <tr className="border-b border-border/50 align-top">
      <td className="py-2 pr-2">{item.studentName}</td>
      <td className="py-2 pr-2 font-mono text-xs">
        {(item.studentNumber ?? "").trim() || (
          <span className="text-destructive">Missing</span>
        )}
      </td>
      <td className="py-2 pr-2">{item.sourceClassLabel}</td>
      <td className="py-2 pr-2" colSpan={4}>
        <form action={action} className="grid grid-cols-[8rem_minmax(10rem,1fr)_minmax(8rem,1fr)_auto] gap-2">
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="itemId" value={item.id} />
          <select
            name="disposition"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as YearEndDisposition)}
            className="border-input bg-background rounded-md border px-2 py-1.5"
          >
            {YEAR_END_DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {YEAR_END_DISPOSITION_LABELS[d]}
              </option>
            ))}
          </select>
          <select
            name="destinationClassId"
            defaultValue={item.destinationClassId ?? "__none__"}
            disabled={!needsDest}
            className="border-input bg-background rounded-md border px-2 py-1.5 disabled:opacity-50"
          >
            <option value="__none__">— None —</option>
            {toClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            name="reason"
            defaultValue={item.reason ?? ""}
            placeholder={disposition === "custom" ? "Reason required" : "Optional note"}
            className="border-input bg-background rounded-md border px-2 py-1.5"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            Save
          </Button>
        </form>
        <ActionMessage state={state} />
      </td>
    </tr>
  );
}

function PreviewPanel({
  data,
}: {
  data: Extract<YearEndWorkspaceData, { ok: true }>;
}) {
  const plan = data.plan!;
  const [readyState, readyAction, readyPending] = useActionState(
    markYearEndPlanReadyAction,
    undefined,
  );
  const [draftState, draftAction, draftPending] = useActionState(
    revertYearEndPlanToDraftAction,
    undefined,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preview & readiness</CardTitle>
          <CardDescription>
            Counts and blockers for this draft. Marking READY does not enroll, archive, graduate, or
            flip Current.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Students" value={data.counts.total} />
            <Stat label="Promote" value={data.counts.promote} />
            <Stat label="Retain" value={data.counts.retain} />
            <Stat label="Remap" value={data.counts.remap} />
            <Stat label="Graduate Primary" value={data.counts.graduate_primary} />
            <Stat label="Leave School" value={data.counts.leave_school} />
            <Stat label="Custom" value={data.counts.custom} />
            <Stat label="Blockers" value={data.counts.blockers} />
          </dl>

          {data.blockers.length > 0 ? (
            <div className="border-destructive/30 bg-destructive/5 rounded-md border p-3">
              <p className="text-destructive mb-2 text-sm font-medium">
                {data.blockers.length} blocker{data.blockers.length === 1 ? "" : "s"}
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {data.blockers.slice(0, 40).map((b, i) => (
                  <li key={`${b.studentId}-${b.code}-${i}`}>
                    {b.message}
                    <span className="text-muted-foreground"> ({b.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : data.counts.total === 0 ? (
            <p className="text-muted-foreground text-sm">
              Refresh the student plan before marking READY.
            </p>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              No blockers — plan can be marked READY.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <form action={readyAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <Button type="submit" disabled={readyPending || !data.readyEligible}>
                {readyPending ? "Validating…" : "Mark READY"}
              </Button>
            </form>
            {plan.status === "ready" ? (
              <form action={draftAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <Button type="submit" variant="secondary" disabled={draftPending}>
                  Revert to draft
                </Button>
              </form>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled
              title="Finalization will be enabled in a later phase."
            >
              Finalize
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Finalization will be enabled in a later phase.
          </p>
          <ActionMessage state={readyState} />
          <ActionMessage state={draftState} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 px-3 py-2">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
