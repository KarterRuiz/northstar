import { z } from "zod";

import { CLASS_TEACHER_UI_EXTRA_ROLE_KEYS } from "./constants";

const uiExtraRoleEnum = z.enum(CLASS_TEACHER_UI_EXTRA_ROLE_KEYS);

export const additionalTeacherRowSchema = z.object({
  teacherProfileId: z.string().uuid(),
  uiRole: uiExtraRoleEnum,
});

/** Payload for `createClassWithTeachersAction` (server + client validation). */
export const createClassWithTeachersBodySchema = z
  .object({
    schoolYearId: z.string().uuid(),
    gradeLevelId: z.string().uuid(),
    name: z.string().trim().min(1, "Class name is required.").max(200),
    section: z.string().trim().min(1, "Section is required.").max(80),
    homeroomTeacherProfileId: z.string().uuid(),
    additionalTeachers: z.array(additionalTeacherRowSchema).max(24),
    /** Accepted for validation; `classes` has no room/capacity columns yet (not persisted). */
    roomNumber: z.string().trim().max(40).optional(),
    capacity: z.coerce.number().int().min(1).max(999).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const extras = data.additionalTeachers;
    const seen = new Set<string>();
    for (let i = 0; i < extras.length; i += 1) {
      const id = extras[i]!.teacherProfileId;
      if (id === data.homeroomTeacherProfileId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Additional teachers cannot include the homeroom teacher.",
          path: ["additionalTeachers", i, "teacherProfileId"],
        });
      }
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each teacher can only appear once in additional teachers.",
          path: ["additionalTeachers", i, "teacherProfileId"],
        });
      }
      seen.add(id);
    }
  });

export type CreateClassWithTeachersInput = z.infer<typeof createClassWithTeachersBodySchema>;
