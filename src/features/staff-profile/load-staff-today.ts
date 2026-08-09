import "server-only";

import { cache } from "react";

import { todayIso } from "@/features/attendance/attendance-date-utils";
import {
  isStaffAttendanceStatus,
  type StaffAttendanceStatus,
} from "@/features/staff-profile/constants";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffTodayException = {
  staffMemberId: string;
  fullName: string;
  role: string;
  status: StaffAttendanceStatus;
};

export type StaffTodaySummary = {
  date: string;
  expectedCount: number;
  present: number;
  absent: number;
  late: number;
  notRecorded: number;
  other: number;
  /** Absent / late individuals only — not a full roster dump. */
  exceptions: StaffTodayException[];
  error: string | null;
  /** True when staff_attendance table appears unavailable. */
  migrationPending: boolean;
};

/**
 * Leadership Staff Today — summary counts + exception list (absent/late).
 * Does not list every present or not-recorded staff member by default.
 */
export const loadStaffTodaySummary = cache(
  async (): Promise<StaffTodaySummary> => {
    const date = todayIso();
    const empty: StaffTodaySummary = {
      date,
      expectedCount: 0,
      present: 0,
      absent: 0,
      late: 0,
      notRecorded: 0,
      other: 0,
      exceptions: [],
      error: null,
      migrationPending: false,
    };

    if (!isSupabaseConfigured()) return empty;

    const supabase = await createServerSupabaseClient();

    const { data: members, error: membersError } = await supabase
      .from("staff_members")
      .select("id, full_name, role, status")
      .is("archived_at", null)
      .neq("status", "disabled")
      .neq("status", "archived");

    if (membersError) {
      return { ...empty, error: "unavailable" };
    }

    const roster = members ?? [];
    const expectedCount = roster.length;
    if (expectedCount === 0) return empty;

    const memberIds = roster.map((m) => m.id);
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("staff_attendance")
      .select("staff_member_id, status")
      .eq("attendance_date", date)
      .in("staff_member_id", memberIds);

    if (attendanceError) {
      const migrationPending =
        /staff_attendance|schema cache|does not exist/i.test(
          attendanceError.message ?? "",
        );
      return {
        ...empty,
        expectedCount,
        notRecorded: expectedCount,
        migrationPending,
        error: migrationPending ? null : "unavailable",
      };
    }

    const statusByMember = new Map<string, StaffAttendanceStatus>();
    for (const row of attendanceRows ?? []) {
      if (isStaffAttendanceStatus(row.status)) {
        statusByMember.set(row.staff_member_id, row.status);
      }
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let notRecorded = 0;
    let other = 0;
    const exceptions: StaffTodayException[] = [];

    for (const member of roster) {
      const status = statusByMember.get(member.id) ?? "not_recorded";
      switch (status) {
        case "present":
          present += 1;
          break;
        case "absent":
          absent += 1;
          exceptions.push({
            staffMemberId: member.id,
            fullName: member.full_name,
            role: member.role,
            status,
          });
          break;
        case "late":
          late += 1;
          exceptions.push({
            staffMemberId: member.id,
            fullName: member.full_name,
            role: member.role,
            status,
          });
          break;
        case "not_recorded":
          notRecorded += 1;
          break;
        default:
          other += 1;
      }
    }

    exceptions.sort((a, b) => {
      const rank = (s: StaffAttendanceStatus) => (s === "absent" ? 0 : 1);
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      date,
      expectedCount,
      present,
      absent,
      late,
      notRecorded,
      other,
      exceptions,
      error: null,
      migrationPending: false,
    };
  },
);
