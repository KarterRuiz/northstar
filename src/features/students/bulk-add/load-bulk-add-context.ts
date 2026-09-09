import "server-only";

import { cache } from "react";

import { GENERIC_INFORMATION_LOAD_ERROR } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadStudentFormClassOptions } from "@/features/students/student-form-queries";

import type { BulkAddClassOption } from "./types";

export type BulkAddPageContext =
  | {
      ok: true;
      classes: BulkAddClassOption[];
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

    return {
      ok: true,
      classes: classesLoad.classes.map((c) => ({
        id: c.id,
        schoolYearId: c.schoolYearId,
        label: c.label,
      })),
    };
  },
);
