"use server";

/**
 * Roster import server API (beta).
 *
 * Architecture: parse → map → validate → plan → apply (batched).
 * Progress is client-driven via batched server actions (no import_jobs table).
 * Tradeoff: closing the tab mid-import stops progress; durable jobs can be
 * added later without changing the field catalog or plan/apply modules.
 */

import { revalidatePath } from "next/cache";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { applyColumnMapping, autoMapColumnsDetailed, mappingCompleteness } from "./auto-map-columns";
import {
  applyPlannedRow,
  archiveLeavingStudents,
  ensureMissingStructure,
} from "./apply-roster-import";
import { buildRosterImportPlan } from "./build-import-plan";
import { ROSTER_FIELD_CATALOG, type RosterFieldId } from "./field-catalog";
import { loadRosterImportContext } from "./load-roster-context";
import {
  buildBlankCsvTemplate,
  buildBlankXlsxTemplate,
  buildErrorReportCsv,
  buildImportReportCsv,
  parseRosterBuffer,
} from "./parse-roster-file";
import type {
  ColumnMapping,
  ColumnMappingOrigins,
  ParsedRosterFile,
  RosterImportOptions,
  RosterImportPlan,
  RosterImportSummary,
  RosterPlannedRow,
} from "./types";
import { DEFAULT_ROSTER_IMPORT_OPTIONS as DEFAULT_OPTIONS } from "./types";

export type ParseRosterResult =
  | {
      ok: true;
      file: ParsedRosterFile;
      suggestedMapping: ColumnMapping;
      mappingOrigins: ColumnMappingOrigins;
      ambiguousHeaders: string[];
      missingRequired: RosterFieldId[];
    }
  | { ok: false; message: string };

export type ValidateRosterResult =
  | {
      ok: true;
      plan: RosterImportPlan;
      cataloguedFieldsMapped: { id: RosterFieldId; label: string }[];
    }
  | { ok: false; message: string };

export type ApplyRosterBatchInput = {
  dashboardRole: string;
  options: RosterImportOptions;
  plannedRows: RosterPlannedRow[];
  leavingStudents: RosterImportPlan["leavingStudents"];
  cursor: number;
  batchSize?: number;
  /** Run structure ensure + archive leavers only on first batch. */
  bootstrap?: boolean;
  /** Running totals from prior batches (for final audit). */
  totalsSoFar?: {
    added: number;
    updated: number;
    archived: number;
    gradesCreated: number;
    classesCreated: number;
    errorCount: number;
  };
};

export type ApplyRosterBatchResult =
  | {
      ok: true;
      processed: number;
      remaining: number;
      added: number;
      updated: number;
      archived: number;
      gradesCreated: number;
      classesCreated: number;
      errors: { rowNumber: number; message: string }[];
      done: boolean;
      cursor: number;
      plannedRows: RosterPlannedRow[];
    }
  | { ok: false; message: string };

async function authorizeRosterImport(
  formRoleRaw: string,
): Promise<
  | { ok: true; userId: string; role: Role }
  | { ok: false; message: string }
> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to import a roster." };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole || !canManageStudents(profileRole)) {
    return {
      ok: false,
      message: "You do not have permission to import student rosters.",
    };
  }

  if (!isRole(formRoleRaw) || formRoleRaw !== profileRole) {
    return { ok: false, message: "Workspace mismatch; refresh the page and try again." };
  }

  return { ok: true, userId: user.id, role: profileRole };
}

function coerceOptions(raw: Partial<RosterImportOptions> | null | undefined): RosterImportOptions {
  return {
    updateExisting: raw?.updateExisting ?? DEFAULT_OPTIONS.updateExisting,
    createNew: raw?.createNew ?? DEFAULT_OPTIONS.createNew,
    archiveWithdrawn: raw?.archiveWithdrawn ?? DEFAULT_OPTIONS.archiveWithdrawn,
    createMissingGrades: raw?.createMissingGrades ?? DEFAULT_OPTIONS.createMissingGrades,
    createMissingClasses: raw?.createMissingClasses ?? DEFAULT_OPTIONS.createMissingClasses,
  };
}

export async function parseRosterUploadAction(
  dashboardRole: string,
  formData: FormData,
): Promise<ParseRosterResult> {
  const auth = await authorizeRosterImport(dashboardRole);
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a CSV or Excel file to upload." };
  }

  const sheetNameRaw = formData.get("sheetName");
  const headerRowRaw = formData.get("headerRowIndex");
  const sheetName =
    typeof sheetNameRaw === "string" && sheetNameRaw.trim()
      ? sheetNameRaw.trim()
      : null;
  const headerRowIndex =
    typeof headerRowRaw === "string" && headerRowRaw.trim() !== ""
      ? Number(headerRowRaw)
      : null;

  const buffer = await file.arrayBuffer();
  const parsed = parseRosterBuffer(buffer, file.name || "roster.csv", {
    sheetName,
    headerRowIndex:
      headerRowIndex != null && Number.isFinite(headerRowIndex)
        ? headerRowIndex
        : null,
  });
  if (!parsed.ok) return parsed;

  const suggested = autoMapColumnsDetailed(parsed.data.headers);
  const { missingRequired } = mappingCompleteness(suggested.mapping);

  return {
    ok: true,
    file: parsed.data,
    suggestedMapping: suggested.mapping,
    mappingOrigins: suggested.origins,
    ambiguousHeaders: suggested.ambiguousHeaders,
    missingRequired,
  };
}

export async function validateRosterImportAction(input: {
  dashboardRole: string;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  headerRowNumber?: number;
  options?: Partial<RosterImportOptions>;
}): Promise<ValidateRosterResult> {
  const auth = await authorizeRosterImport(input.dashboardRole);
  if (!auth.ok) return auth;

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { missingRequired } = mappingCompleteness(input.mapping);
  if (missingRequired.length > 0) {
    const labels = missingRequired.map((id) => {
      const field = ROSTER_FIELD_CATALOG.find((f) => f.id === id);
      return field?.label ?? id;
    });
    return {
      ok: false,
      message: `Map required columns before validating: ${labels.join(", ")}.`,
    };
  }

  const contextLoad = await loadRosterImportContext();
  if (!contextLoad.ok) return contextLoad;

  const mapped = applyColumnMapping(input.rows, input.mapping, {
    headerRowNumber: input.headerRowNumber ?? 1,
  });
  const options = coerceOptions(input.options);
  const plan = buildRosterImportPlan(mapped, contextLoad.context, options);

  const cataloguedFieldsMapped = ROSTER_FIELD_CATALOG.filter(
    (f) => f.status === "catalogued" && input.mapping[f.id],
  ).map((f) => ({ id: f.id, label: f.label }));

  return { ok: true, plan, cataloguedFieldsMapped };
}

export async function applyRosterImportBatchAction(
  input: ApplyRosterBatchInput,
): Promise<ApplyRosterBatchResult> {
  const auth = await authorizeRosterImport(input.dashboardRole);
  if (!auth.ok) return auth;

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const options = coerceOptions(input.options);
  const batchSize = Math.min(Math.max(input.batchSize ?? 25, 1), 100);
  const plannedRows = input.plannedRows.map((r) => ({ ...r }));
  let cursor = Math.max(0, input.cursor);
  let added = 0;
  let updated = 0;
  let archived = 0;
  let gradesCreated = 0;
  let classesCreated = 0;
  const errors: { rowNumber: number; message: string }[] = [];

  const supabase = await createServerSupabaseClient();

  if (input.bootstrap && cursor === 0) {
    const contextLoad = await loadRosterImportContext();
    if (!contextLoad.ok) return contextLoad;

    if (options.createMissingGrades || options.createMissingClasses) {
      const ensured = await ensureMissingStructure(
        supabase,
        contextLoad.context,
        plannedRows,
        options,
      );
      gradesCreated = ensured.gradesCreated;
      classesCreated = ensured.classesCreated;
      for (const msg of ensured.errors) {
        errors.push({ rowNumber: 0, message: msg });
      }
    }

    if (options.archiveWithdrawn && input.leavingStudents.length > 0) {
      const leaveResult = await archiveLeavingStudents(
        supabase,
        input.leavingStudents.map((l) => ({
          studentId: l.studentId,
          enrollmentId: l.enrollmentId,
        })),
      );
      archived = leaveResult.archived;
      errors.push(...leaveResult.errors);
    }
  }

  const end = Math.min(cursor + batchSize, plannedRows.length);
  for (let i = cursor; i < end; i++) {
    const row = plannedRows[i]!;
    const result = await applyPlannedRow(supabase, row, options);
    if (!result.ok) {
      errors.push({ rowNumber: row.rowNumber, message: result.message });
    } else if (result.action === "added") {
      added += 1;
    } else if (result.action === "updated") {
      updated += 1;
    }
  }

  cursor = end;
  const done = cursor >= plannedRows.length;
  const processed = cursor;
  const remaining = Math.max(0, plannedRows.length - cursor);

  if (done) {
    const prior = input.totalsSoFar ?? {
      added: 0,
      updated: 0,
      archived: 0,
      gradesCreated: 0,
      classesCreated: 0,
      errorCount: 0,
    };
    await recordAuditEvent({
      action: "roster_imported",
      actorUserId: auth.userId,
      metadata: {
        added: prior.added + added,
        updated: prior.updated + updated,
        archived: prior.archived + archived,
        errorCount: prior.errorCount + errors.length,
        gradesCreated: prior.gradesCreated + gradesCreated,
        classesCreated: prior.classesCreated + classesCreated,
        totalRows: plannedRows.length,
        schoolYearId: plannedRows[0]?.schoolYearId ?? null,
      },
    });

    revalidatePath(`/dashboard/${auth.role}/students`, "page");
    revalidatePath(`/dashboard/${auth.role}/classes`, "page");
    revalidatePath(`/dashboard/${auth.role}/school-settings`, "page");
  }

  return {
    ok: true,
    processed,
    remaining,
    added,
    updated,
    archived,
    gradesCreated,
    classesCreated,
    errors,
    done,
    cursor,
    plannedRows,
  };
}

export async function getRosterTemplateCsvAction(
  dashboardRole: string,
): Promise<{ ok: true; csv: string; fileName: string } | { ok: false; message: string }> {
  const auth = await authorizeRosterImport(dashboardRole);
  if (!auth.ok) return auth;
  return {
    ok: true,
    csv: buildBlankCsvTemplate(),
    fileName: "northstar-student-roster-template.csv",
  };
}

export async function getRosterTemplateXlsxAction(
  dashboardRole: string,
): Promise<
  | { ok: true; base64: string; fileName: string }
  | { ok: false; message: string }
> {
  const auth = await authorizeRosterImport(dashboardRole);
  if (!auth.ok) return auth;
  const bytes = buildBlankXlsxTemplate();
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    ok: true,
    base64,
    fileName: "northstar-student-roster-template.xlsx",
  };
}

export async function buildRosterErrorReportAction(
  dashboardRole: string,
  issues: { rowNumber: number; severity: string; message: string; field?: string }[],
): Promise<{ ok: true; csv: string } | { ok: false; message: string }> {
  const auth = await authorizeRosterImport(dashboardRole);
  if (!auth.ok) return auth;
  return { ok: true, csv: buildErrorReportCsv(issues) };
}

export async function buildRosterImportReportAction(
  dashboardRole: string,
  summary: RosterImportSummary,
): Promise<{ ok: true; csv: string } | { ok: false; message: string }> {
  const auth = await authorizeRosterImport(dashboardRole);
  if (!auth.ok) return auth;
  return { ok: true, csv: buildImportReportCsv(summary) };
}
