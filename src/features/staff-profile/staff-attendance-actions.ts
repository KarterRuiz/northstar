"use server";

import { revalidatePath } from "next/cache";

import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { todayIso } from "@/features/attendance/attendance-date-utils";
import {
  isStaffAttendanceStatus,
  type StaffAttendanceStatus,
} from "@/features/staff-profile/constants";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { isUuid } from "@/lib/students/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffAttendanceActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function upsertStaffAttendanceAction(
  _prev: StaffAttendanceActionState | undefined,
  formData: FormData,
): Promise<StaffAttendanceActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You are not authorized to record staff attendance." };
  }

  const staffMemberIdRaw = formData.get("staffMemberId");
  const statusRaw = formData.get("status");
  const dateRaw = formData.get("attendanceDate");
  const notesRaw = formData.get("notes");

  if (typeof staffMemberIdRaw !== "string" || !isUuid(staffMemberIdRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = staffMemberIdRaw.trim();

  if (typeof statusRaw !== "string" || !isStaffAttendanceStatus(statusRaw)) {
    return { ok: false, message: "Choose a valid attendance status." };
  }
  const status = statusRaw as StaffAttendanceStatus;

  const attendanceDate =
    typeof dateRaw === "string" && DATE_RE.test(dateRaw.trim())
      ? dateRaw.trim()
      : todayIso();

  const notes =
    typeof notesRaw === "string" && notesRaw.trim()
      ? notesRaw.trim().slice(0, 500)
      : null;

  const { data: existing } = await supabase
    .from("staff_attendance")
    .select("id, status")
    .eq("staff_member_id", staffMemberId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  const { error } = await supabase.from("staff_attendance").upsert(
    {
      staff_member_id: staffMemberId,
      attendance_date: attendanceDate,
      status,
      notes,
      recorded_by: actor.userId,
    },
    { onConflict: "staff_member_id,attendance_date" },
  );

  if (error) {
    return {
      ok: false,
      message:
        "Could not save staff attendance. Confirm the staff attendance migration is applied.",
    };
  }

  const correcting = Boolean(existing) && existing!.status !== status;
  await recordAuditEvent({
    action: correcting ? "staff_attendance_corrected" : "staff_attendance_recorded",
    actorUserId: actor.userId,
    metadata: {
      staffMemberId,
      attendanceDate,
      status,
      ...(correcting ? { previousStatus: existing!.status } : {}),
    },
  });

  const base = staffDirectoryPath(actor.role);
  revalidatePath(base);
  revalidatePath(`${base}/${staffMemberId}`);
  revalidatePath(`/dashboard/${actor.role}`);

  return {
    ok: true,
    message: correcting
      ? "Attendance updated."
      : "Attendance recorded.",
  };
}
