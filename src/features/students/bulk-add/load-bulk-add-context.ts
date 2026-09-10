import "server-only";

import { cache } from "react";

import { GENERIC_INFORMATION_LOAD_ERROR } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadStudentFormClassOptions } from "@/features/students/student-form-queries";
import { studentNumberMatchKey } from "@/features/students/student-number";

import type { BulkAddClassOption } from "./types";

export type BulkAddPageContext =
  | {
      ok: true;
      classes: BulkAddClassOption[];
      /** Match keys of existing Student Numbers for client-side duplicate checks. */
      existingStudentNumbers: string[];
    }
  | { ok: false; message: string };

export const loadBulkAddPageContext = cache(
  async (): Promise<BulkAddPageContext> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const classesLoad = await loadStudentFormClassOptions();
    if (!classesLoad.ok) {
      return { ok: false, message: classesLoad.message };
    }

    const supabase = await createServerSupabaseClient();
    const { data: numberRows } = await supabase
      .from("students")
      .select("external_id")
      .not("external_id", "is", null);

    const existingStudentNumbers = [
      ...new Set(
        (numberRows ?? [])
          .map((r) => r.external_id?.trim())
          .filter((v): v is string => Boolean(v))
          .map(studentNumberMatchKey),
      ),
    ];

    return {
      ok: true,
      classes: classesLoad.classes.map((c) => ({
        id: c.id,
        schoolYearId: c.schoolYearId,
        label: c.label,
      })),
      existingStudentNumbers,
    };
  },
);
