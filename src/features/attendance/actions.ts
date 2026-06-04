"use server";

import { revalidatePath } from "next/cache";

import { attendanceStatuses, type SaveAttendanceBulkInput } from "./schema";
import { requireTeacherAssignedToClass } from "@/lib/auth/teacher-class-access";
import { isStudentId, isUuid } from "@/lib/students/uuid";

export type AttendanceActionResult = { ok: true } | { ok: false; message: string };

function attendancePath() {
  return "/dashboard/teacher/attendance";
}

function revalidateAttendance(classId: string) {
  revalidatePath(attendancePath(), "page");
  revalidatePath("/dashboard/teacher", "page");
  revalidatePath("/dashboard/teacher/interventions", "page");
  revalidatePath(`/dashboard/teacher/classes/${classId}`, "page");
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function saveAttendanceBulkAction(
  input: SaveAttendanceBulkInput,
): Promise<AttendanceActionResult> {
  if (!isUuid(input.classId)) return { ok: false, message: "Invalid class id." };
  if (!input.schoolYear.trim()) return { ok: false, message: "School year is required." };
  if (!isIsoDate(input.attendanceDate)) {
    return { ok: false, message: "Attendance date must be YYYY-MM-DD." };
  }
  if (input.rows.length === 0) {
    return { ok: false, message: "No attendance rows to save." };
  }

  for (const row of input.rows) {
    if (!isStudentId(row.studentId)) return { ok: false, message: "Invalid student id." };
    if (!attendanceStatuses.includes(row.status)) {
      return { ok: false, message: "Invalid attendance status." };
    }
  }

  const gate = await requireTeacherAssignedToClass(input.classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const payload = input.rows.map((row) => ({
    student_id: row.studentId,
    class_id: input.classId,
    school_year: input.schoolYear.trim(),
    attendance_date: input.attendanceDate,
    status: row.status,
    notes: row.notes?.trim() || null,
    recorded_by: userId,
  }));

  const { error } = await supabase.from("attendance_records").upsert(payload, {
    onConflict: "student_id,class_id,attendance_date",
  });

  if (error) return { ok: false, message: error.message };

  revalidateAttendance(input.classId);
  for (const row of input.rows) {
    revalidatePath(`/dashboard/teacher/students/${row.studentId}`, "layout");
  }

  return { ok: true };
}
