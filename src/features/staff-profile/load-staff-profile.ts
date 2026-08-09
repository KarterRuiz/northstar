import "server-only";

import { cache } from "react";

import {
  fetchClassAssignmentsForStaffMembers,
  fetchGradeAccessForStaffMembers,
  type StaffClassAssignmentRow,
  type StaffGradeAccessRow,
  type StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import { todayIso } from "@/features/attendance/attendance-date-utils";
import {
  isStaffAttendanceStatus,
  type StaffAttendanceStatus,
} from "@/features/staff-profile/constants";
import { resolveStaffRosterDisplayStatus } from "@/lib/staff/staff-roster-status";
import { isUuid } from "@/lib/students/uuid";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type StaffProfileLoadResult =
  | { kind: "ok"; member: StaffMemberRow }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export type StaffAttendanceRow = {
  id: string;
  staffMemberId: string;
  attendanceDate: string;
  status: StaffAttendanceStatus;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  other: number;
  notRecorded: number;
  recent: StaffAttendanceRow[];
  today: StaffAttendanceRow | null;
};

export const loadStaffMemberProfile = cache(
  async (staffMemberId: string): Promise<StaffProfileLoadResult> => {
    if (!isUuid(staffMemberId)) return { kind: "not_found" };
    if (!isSupabaseConfigured()) {
      return { kind: "error", message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();
    const { data: member, error } = await supabase
      .from("staff_members")
      .select(
        "id, first_name, last_name, full_name, email, role, status, notes, profile_id, archived_at, last_activity_at, created_at, updated_at",
      )
      .eq("id", staffMemberId)
      .maybeSingle();

    if (error) {
      return { kind: "error", message: "Could not load this staff member." };
    }
    if (!member) return { kind: "not_found" };

    const [inviteRes, profileRes] = await Promise.all([
      supabase
        .from("staff_invitations")
        .select(
          "status, expires_at, opened_at, accepted_at, sent_at, invite_token, updated_at",
        )
        .eq("staff_member_id", staffMemberId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      member.profile_id
        ? supabase
            .from("profiles")
            .select("id, is_active")
            .eq("id", member.profile_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const invite = inviteRes.data;
    const profileIsActive = profileRes.data?.is_active ?? null;

    const row: StaffMemberRow = {
      ...member,
      profileIsActive,
      displayStatus: resolveStaffRosterDisplayStatus({
        membershipStatus: member.status,
        archivedAt: member.archived_at,
        profileId: member.profile_id,
        profileIsActive,
        latestInvite: invite
          ? {
              status: invite.status,
              expires_at: invite.expires_at,
              opened_at: invite.opened_at,
              accepted_at: invite.accepted_at,
            }
          : null,
      }),
      inviteToken: invite?.invite_token ?? null,
      inviteSentAt: invite?.sent_at ?? null,
      inviteOpenedAt: invite?.opened_at ?? null,
      inviteAcceptedAt: invite?.accepted_at ?? null,
      inviteStatus: invite?.status ?? null,
    };

    return { kind: "ok", member: row };
  },
);

export const loadStaffProfileAssignments = cache(
  async (
    staffMemberId: string,
  ): Promise<{
    grades: StaffGradeAccessRow[];
    classes: StaffClassAssignmentRow[];
  }> => {
    if (!isUuid(staffMemberId)) return { grades: [], classes: [] };
    const [gradesMap, classesMap] = await Promise.all([
      fetchGradeAccessForStaffMembers([staffMemberId]),
      fetchClassAssignmentsForStaffMembers([staffMemberId]),
    ]);
    return {
      grades: gradesMap.get(staffMemberId) ?? [],
      classes: classesMap.get(staffMemberId) ?? [],
    };
  },
);

function mapAttendanceRow(
  row: Database["public"]["Tables"]["staff_attendance"]["Row"],
): StaffAttendanceRow | null {
  if (!isStaffAttendanceStatus(row.status)) return null;
  return {
    id: row.id,
    staffMemberId: row.staff_member_id,
    attendanceDate: row.attendance_date,
    status: row.status,
    notes: row.notes,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const loadStaffAttendanceForMember = cache(
  async (
    staffMemberId: string,
    opts?: { recentLimit?: number },
  ): Promise<StaffAttendanceSummary> => {
    const empty: StaffAttendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      other: 0,
      notRecorded: 0,
      recent: [],
      today: null,
    };
    if (!isUuid(staffMemberId) || !isSupabaseConfigured()) return empty;

    const supabase = await createServerSupabaseClient();
    const today = todayIso();
    const recentLimit = opts?.recentLimit ?? 14;

    const { data, error } = await supabase
      .from("staff_attendance")
      .select(
        "id, staff_member_id, attendance_date, status, notes, recorded_by, created_at, updated_at",
      )
      .eq("staff_member_id", staffMemberId)
      .order("attendance_date", { ascending: false })
      .limit(90);

    if (error || !data) {
      // Table may not exist until migration is applied — degrade quietly.
      return empty;
    }

    const mapped = data
      .map(mapAttendanceRow)
      .filter((r): r is StaffAttendanceRow => r != null);

    const todayRow = mapped.find((r) => r.attendanceDate === today) ?? null;
    const recent = mapped.slice(0, recentLimit);

    let present = 0;
    let absent = 0;
    let late = 0;
    let other = 0;
    let notRecorded = 0;
    for (const row of mapped) {
      switch (row.status) {
        case "present":
          present += 1;
          break;
        case "absent":
          absent += 1;
          break;
        case "late":
          late += 1;
          break;
        case "not_recorded":
          notRecorded += 1;
          break;
        default:
          other += 1;
      }
    }

    return {
      present,
      absent,
      late,
      other,
      notRecorded,
      recent,
      today: todayRow,
    };
  },
);

export const loadStaffTodayAttendanceStatus = cache(
  async (
    staffMemberId: string,
  ): Promise<StaffAttendanceStatus | null> => {
    const summary = await loadStaffAttendanceForMember(staffMemberId, {
      recentLimit: 1,
    });
    return summary.today?.status ?? null;
  },
);
