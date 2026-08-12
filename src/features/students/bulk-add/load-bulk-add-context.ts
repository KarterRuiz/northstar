import "server-only";

import { cache } from "react";

import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeMatchKey } from "@/features/students/roster-import/match-helpers";
import { loadStudentFormClassOptions } from "@/features/students/student-form-queries";

import type { BulkAddClassOption } from "./types";

export type BulkAddPageContext =
  | {
      ok: true;
      classes: BulkAddClassOption[];
      existingExternalIds: string[];
    }
  | { ok: false; message: string };

export const loadBulkAddPageContext = cache(
  async (): Promise<BulkAddPageContext> => {
    const classesLoad = await loadStudentFormClassOptions();
    if (!classesLoad.ok) {
      return { ok: false, message: classesLoad.message };
    }

    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .select("external_id")
      .not("external_id", "is", null)
      .limit(5000);

    if (error) {
      logServerError("bulk-add.loadExternalIds", error.message);
      return {
        ok: false,
        message: safeUserFacingMessage(
          error.message,
          "Could not load existing student numbers. Try again.",
        ),
      };
    }

    const existingExternalIds = (data ?? [])
      .map((row) => row.external_id)
      .filter((v): v is string => Boolean(v?.trim()))
      .map((v) => normalizeMatchKey(v));

    return {
      ok: true,
      classes: classesLoad.classes.map((c) => ({
        id: c.id,
        schoolYearId: c.schoolYearId,
        label: c.label,
      })),
      existingExternalIds,
    };
  },
);
