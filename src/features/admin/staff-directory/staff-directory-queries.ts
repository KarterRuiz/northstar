import "server-only";

import { cache } from "react";

import { isRole, type Role } from "@/config/roles";
import {
  resolveStaffRosterDisplayStatus,
  type StaffRosterDisplayStatus,
} from "@/lib/staff/staff-roster-status";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type StaffMemberRow = Pick<
  Database["public"]["Tables"]["staff_members"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "role"
  | "status"
  | "notes"
  | "profile_id"
  | "archived_at"
  | "last_activity_at"
  | "created_at"
  | "updated_at"
> & {
  profileIsActive: boolean | null;
  displayStatus: StaffRosterDisplayStatus;
  inviteToken: string | null;
  inviteSentAt: string | null;
  inviteOpenedAt: string | null;
  inviteAcceptedAt: string | null;
  inviteStatus: Database["public"]["Tables"]["staff_invitations"]["Row"]["status"] | null;
};

/** @deprecated Prefer StaffMemberRow — kept for transitional imports. */
export type StaffProfileRow = {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffDirectoryPage = {
  rows: StaffMemberRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  error: string | null;
  filters: {
    q: string;
    role: Role | "";
    status: "all" | StaffRosterDisplayStatus;
  };
};

export type StaffClassAssignmentRow = {
  assignmentId: string;
  staffMemberId: string;
  teacherProfileId: string | null;
  classId: string;
  className: string;
  section: string | null;
  schoolYearLabel: string;
  gradeName: string;
  assignmentRole: string;
  classIsActive: boolean;
};

export type StaffGradeAccessRow = {
  id: string;
  staffMemberId: string;
  profileId: string | null;
  gradeLevelId: string;
  gradeName: string;
  gradeSortOrder: number;
};

export type StaffDirectorySummary = {
  activeStaff: number;
  teachers: number;
  readyToInvite: number;
  pendingInvitations: number;
  error: string | null;
};

const DEFAULT_PAGE_SIZE = 25;

function clampPage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function assignmentSortLabel(a: StaffClassAssignmentRow): string {
  return `${a.schoolYearLabel} ${a.gradeName} ${a.className}`.toLowerCase();
}

const DISPLAY_STATUSES: StaffRosterDisplayStatus[] = [
  "draft",
  "ready",
  "invitation_sent",
  "opened",
  "accepted",
  "active",
  "disabled",
  "archived",
];

function isDisplayStatus(v: string): v is StaffRosterDisplayStatus {
  return (DISPLAY_STATUSES as string[]).includes(v);
}

export const fetchStaffDirectoryPage = cache(
  async (searchParams: {
    page?: string | string[];
    q?: string | string[];
    role?: string | string[];
    status?: string | string[];
  }): Promise<StaffDirectoryPage> => {
    const page = clampPage(firstString(searchParams.page));
    const pageSize = DEFAULT_PAGE_SIZE;
    const qRaw = firstString(searchParams.q)?.trim() ?? "";
    const roleRaw = firstString(searchParams.role)?.trim() ?? "";
    const statusRaw = firstString(searchParams.status)?.trim() ?? "all";

    const roleFilter: Role | "" = isRole(roleRaw) ? roleRaw : "";
    const statusFilter: "all" | StaffRosterDisplayStatus =
      statusRaw === "all" || !isDisplayStatus(statusRaw) ? "all" : statusRaw;

    if (!isSupabaseConfigured()) {
      return {
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize,
        error: "Supabase is not configured.",
        filters: { q: qRaw, role: roleFilter, status: statusFilter },
      };
    }

    const supabase = await createServerSupabaseClient();

    let listQuery = supabase
      .from("staff_members")
      .select(
        "id, first_name, last_name, full_name, email, role, status, notes, profile_id, archived_at, last_activity_at, created_at, updated_at",
      )
      .order("role", { ascending: true })
      .order("full_name", { ascending: true })
      .order("id", { ascending: true });

    // Default roster hides archived; status=archived filter shows them.
    if (statusFilter !== "archived") {
      listQuery = listQuery.is("archived_at", null);
    }

    if (qRaw.length > 0) {
      const safe = escapeIlike(qRaw);
      listQuery = listQuery.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`,
      );
    }
    if (roleFilter) {
      listQuery = listQuery.eq("role", roleFilter);
    }

    const { data: members, error: listError } = await listQuery;
    if (listError) {
      return {
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize,
        error: listError.message,
        filters: { q: qRaw, role: roleFilter, status: statusFilter },
      };
    }

    const allMembers = members ?? [];
    const memberIds = allMembers.map((m) => m.id);
    const profileIds = allMembers
      .map((m) => m.profile_id)
      .filter((id): id is string => typeof id === "string");

    const [invitesRes, profilesRes] = await Promise.all([
      memberIds.length
        ? supabase
            .from("staff_invitations")
            .select(
              "id, staff_member_id, status, expires_at, opened_at, accepted_at, sent_at, invite_token, updated_at",
            )
            .in("staff_member_id", memberIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase.from("profiles").select("id, is_active").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const latestInviteByMember = new Map<
      string,
      {
        status: Database["public"]["Tables"]["staff_invitations"]["Row"]["status"];
        expires_at: string | null;
        opened_at: string | null;
        accepted_at: string | null;
        sent_at: string | null;
        invite_token: string;
      }
    >();
    for (const inv of invitesRes.data ?? []) {
      if (!inv.staff_member_id) continue;
      if (!latestInviteByMember.has(inv.staff_member_id)) {
        latestInviteByMember.set(inv.staff_member_id, {
          status: inv.status,
          expires_at: inv.expires_at,
          opened_at: inv.opened_at,
          accepted_at: inv.accepted_at,
          sent_at: inv.sent_at,
          invite_token: inv.invite_token,
        });
      }
    }

    const profileActive = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p.is_active] as const),
    );

    let rows: StaffMemberRow[] = allMembers.map((m) => {
      const invite = latestInviteByMember.get(m.id) ?? null;
      const profileIsActive = m.profile_id
        ? (profileActive.get(m.profile_id) ?? null)
        : null;
      const displayStatus = resolveStaffRosterDisplayStatus({
        membershipStatus: m.status,
        archivedAt: m.archived_at,
        profileId: m.profile_id,
        profileIsActive,
        latestInvite: invite,
      });
      return {
        ...m,
        profileIsActive,
        displayStatus,
        inviteToken: invite?.invite_token ?? null,
        inviteSentAt: invite?.sent_at ?? null,
        inviteOpenedAt: invite?.opened_at ?? null,
        inviteAcceptedAt: invite?.accepted_at ?? null,
        inviteStatus: invite?.status ?? null,
      };
    });

    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.displayStatus === statusFilter);
    }

    const totalCount = rows.length;
    const from = (page - 1) * pageSize;
    const pageRows = rows.slice(from, from + pageSize);

    return {
      rows: pageRows,
      totalCount,
      page,
      pageSize,
      error: invitesRes.error?.message ?? profilesRes.error?.message ?? null,
      filters: { q: qRaw, role: roleFilter, status: statusFilter },
    };
  },
);

export const fetchStaffDirectorySummary = cache(
  async (): Promise<StaffDirectorySummary> => {
    if (!isSupabaseConfigured()) {
      return {
        activeStaff: 0,
        teachers: 0,
        readyToInvite: 0,
        pendingInvitations: 0,
        error: "Supabase is not configured.",
      };
    }

    const supabase = await createServerSupabaseClient();
    const nowIso = new Date().toISOString();

    const { data: members } = await supabase
      .from("staff_members")
      .select("id, role, status, profile_id, archived_at, email")
      .is("archived_at", null);

    const memberIds = (members ?? []).map((m) => m.id);
    const { data: invites } = memberIds.length
      ? await supabase
          .from("staff_invitations")
          .select("staff_member_id, status, expires_at, opened_at, updated_at")
          .in("staff_member_id", memberIds)
          .order("updated_at", { ascending: false })
      : { data: [] as const };

    const latestInviteByMember = new Map<
      string,
      {
        status: Database["public"]["Tables"]["staff_invitations"]["Row"]["status"];
        expires_at: string | null;
        opened_at: string | null;
      }
    >();
    for (const inv of invites ?? []) {
      if (!inv.staff_member_id) continue;
      if (!latestInviteByMember.has(inv.staff_member_id)) {
        latestInviteByMember.set(inv.staff_member_id, {
          status: inv.status,
          expires_at: inv.expires_at,
          opened_at: inv.opened_at,
        });
      }
    }

    const profileIds = (members ?? [])
      .map((m) => m.profile_id)
      .filter((id): id is string => !!id);
    const { data: profiles } = profileIds.length
      ? await supabase.from("profiles").select("id, is_active").in("id", profileIds)
      : { data: [] as const };
    const profileActive = new Map((profiles ?? []).map((p) => [p.id, p.is_active] as const));

    let active = 0;
    let teachers = 0;
    let readyToInvite = 0;
    for (const m of members ?? []) {
      const invite = latestInviteByMember.get(m.id) ?? null;
      const status = resolveStaffRosterDisplayStatus({
        membershipStatus: m.status,
        archivedAt: m.archived_at,
        profileId: m.profile_id,
        profileIsActive: m.profile_id ? (profileActive.get(m.profile_id) ?? null) : null,
        latestInvite: invite,
      });
      if (status === "active") active += 1;
      if (m.role === "teacher" && status !== "disabled" && status !== "archived") {
        teachers += 1;
      }
      // Eligible for invite: draft/ready with email, not yet activated.
      if (
        (status === "ready" || status === "draft") &&
        Boolean(m.email?.trim()) &&
        !m.profile_id
      ) {
        readyToInvite += 1;
      }
    }

    const { count: pendingCount, error: pendingError } = await supabase
      .from("staff_invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("expires_at", nowIso);

    return {
      activeStaff: active,
      teachers,
      readyToInvite,
      pendingInvitations: pendingCount ?? 0,
      error: pendingError?.message ?? null,
    };
  },
);

export const fetchGradeAccessForStaffMembers = cache(
  async (staffMemberIds: string[]): Promise<Map<string, StaffGradeAccessRow[]>> => {
    const map = new Map<string, StaffGradeAccessRow[]>();
    if (staffMemberIds.length === 0 || !isSupabaseConfigured()) return map;

    const supabase = await createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("staff_member_grade_levels")
      .select("id, staff_member_id, grade_level_id")
      .in("staff_member_id", staffMemberIds);

    if (error || !rows?.length) return map;

    const gradeIds = [...new Set(rows.map((r) => r.grade_level_id))];
    const { data: grades, error: gErr } = await supabase
      .from("grade_levels")
      .select("id, name, sort_order")
      .in("id", gradeIds);

    if (gErr || !grades?.length) return map;

    const gradeById = new Map(
      grades.map((g) => [
        g.id,
        {
          name: g.name,
          sortOrder: typeof g.sort_order === "number" ? g.sort_order : 0,
        },
      ]),
    );

    const { data: members } = await supabase
      .from("staff_members")
      .select("id, profile_id")
      .in("id", staffMemberIds);
    const profileByMember = new Map(
      (members ?? []).map((m) => [m.id, m.profile_id] as const),
    );

    for (const row of rows) {
      const grade = gradeById.get(row.grade_level_id);
      if (!grade) continue;
      const entry: StaffGradeAccessRow = {
        id: row.id,
        staffMemberId: row.staff_member_id,
        profileId: profileByMember.get(row.staff_member_id) ?? null,
        gradeLevelId: row.grade_level_id,
        gradeName: grade.name,
        gradeSortOrder: grade.sortOrder,
      };
      const list = map.get(row.staff_member_id) ?? [];
      list.push(entry);
      map.set(row.staff_member_id, list);
    }

    for (const [k, list] of map) {
      list.sort((a, b) => {
        if (a.gradeSortOrder !== b.gradeSortOrder) return a.gradeSortOrder - b.gradeSortOrder;
        return a.gradeName.localeCompare(b.gradeName, undefined, { sensitivity: "base" });
      });
      map.set(k, list);
    }

    return map;
  },
);

/** @deprecated Use fetchGradeAccessForStaffMembers */
export const fetchGradeAccessForTeachers = fetchGradeAccessForStaffMembers;

export const fetchClassAssignmentsForStaffMembers = cache(
  async (staffMemberIds: string[]): Promise<Map<string, StaffClassAssignmentRow[]>> => {
    const map = new Map<string, StaffClassAssignmentRow[]>();
    if (staffMemberIds.length === 0 || !isSupabaseConfigured()) return map;

    const supabase = await createServerSupabaseClient();
    const { data: rows, error } = await supabase
      .from("staff_member_classes")
      .select("id, staff_member_id, class_id")
      .in("staff_member_id", staffMemberIds);

    if (error || !rows?.length) return map;

    const classIds = [...new Set(rows.map((r) => r.class_id))];
    const { data: classes, error: cErr } = await supabase
      .from("classes")
      .select("id, name, section, is_active, school_year_id, grade_level_id")
      .in("id", classIds);

    if (cErr || !classes?.length) return map;

    const schoolYearIds = [...new Set(classes.map((c) => c.school_year_id))];
    const gradeIds = [...new Set(classes.map((c) => c.grade_level_id))];

    const [yearsRes, gradesRes, membersRes] = await Promise.all([
      supabase.from("school_years").select("id, label").in("id", schoolYearIds),
      supabase.from("grade_levels").select("id, name").in("id", gradeIds),
      supabase.from("staff_members").select("id, profile_id").in("id", staffMemberIds),
    ]);

    const yearLabel = new Map((yearsRes.data ?? []).map((y) => [y.id, y.label]));
    const gradeName = new Map((gradesRes.data ?? []).map((g) => [g.id, g.name]));
    const classById = new Map(classes.map((c) => [c.id, c]));
    const profileByMember = new Map(
      (membersRes.data ?? []).map((m) => [m.id, m.profile_id] as const),
    );

    for (const row of rows) {
      const klass = classById.get(row.class_id);
      if (!klass) continue;
      const entry: StaffClassAssignmentRow = {
        assignmentId: row.id,
        staffMemberId: row.staff_member_id,
        teacherProfileId: profileByMember.get(row.staff_member_id) ?? null,
        classId: klass.id,
        className: klass.name,
        section: klass.section,
        schoolYearLabel: yearLabel.get(klass.school_year_id) ?? "—",
        gradeName: gradeName.get(klass.grade_level_id) ?? "—",
        assignmentRole: "co_teacher",
        classIsActive: klass.is_active,
      };
      const list = map.get(row.staff_member_id) ?? [];
      list.push(entry);
      map.set(row.staff_member_id, list);
    }

    for (const [k, list] of map) {
      list.sort((a, b) => assignmentSortLabel(a).localeCompare(assignmentSortLabel(b)));
      map.set(k, list);
    }

    return map;
  },
);

/** @deprecated Use fetchClassAssignmentsForStaffMembers */
export const fetchClassAssignmentsForTeachers = fetchClassAssignmentsForStaffMembers;

/** Candidates for the bulk invite modal (not yet invited / not active). */
export const fetchStaffInviteCandidates = cache(async (): Promise<StaffMemberRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data: members } = await supabase
    .from("staff_members")
    .select(
      "id, first_name, last_name, full_name, email, role, status, notes, profile_id, archived_at, last_activity_at, created_at, updated_at",
    )
    .is("archived_at", null)
    .order("full_name", { ascending: true });

  const all = members ?? [];
  const memberIds = all.map((m) => m.id);
  const { data: invites } = memberIds.length
    ? await supabase
        .from("staff_invitations")
        .select(
          "staff_member_id, status, expires_at, opened_at, accepted_at, sent_at, invite_token, updated_at",
        )
        .in("staff_member_id", memberIds)
        .order("updated_at", { ascending: false })
    : { data: [] as const };

  const latestInviteByMember = new Map<
    string,
    {
      status: Database["public"]["Tables"]["staff_invitations"]["Row"]["status"];
      expires_at: string | null;
      opened_at: string | null;
      accepted_at: string | null;
      sent_at: string | null;
      invite_token: string;
    }
  >();
  for (const inv of invites ?? []) {
    if (!inv.staff_member_id) continue;
    if (!latestInviteByMember.has(inv.staff_member_id)) {
      latestInviteByMember.set(inv.staff_member_id, {
        status: inv.status,
        expires_at: inv.expires_at,
        opened_at: inv.opened_at,
        accepted_at: inv.accepted_at,
        sent_at: inv.sent_at,
        invite_token: inv.invite_token,
      });
    }
  }

  return all
    .map((m) => {
      const invite = latestInviteByMember.get(m.id) ?? null;
      const displayStatus = resolveStaffRosterDisplayStatus({
        membershipStatus: m.status,
        archivedAt: m.archived_at,
        profileId: m.profile_id,
        profileIsActive: null,
        latestInvite: invite,
      });
      return {
        ...m,
        profileIsActive: null,
        displayStatus,
        inviteToken: invite?.invite_token ?? null,
        inviteSentAt: invite?.sent_at ?? null,
        inviteOpenedAt: invite?.opened_at ?? null,
        inviteAcceptedAt: invite?.accepted_at ?? null,
        inviteStatus: invite?.status ?? null,
      };
    })
    .filter(
      (r) =>
        r.displayStatus === "draft" ||
        r.displayStatus === "ready" ||
        r.displayStatus === "invitation_sent" ||
        r.displayStatus === "opened",
    );
});
