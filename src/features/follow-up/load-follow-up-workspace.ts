import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  buildFollowUpWorkspaceView,
  hasPartialFollowUpLoad,
  isFollowUpCategory,
  isFollowUpStatus,
  parseFollowUpCategoryFilter,
  parseFollowUpTab,
  todayForFollowUp,
} from "./classify";
import {
  FOLLOW_UP_COMPLETED_PAGE_SIZE,
  FOLLOW_UP_PAGE_SIZE,
  FOLLOW_UP_PARTIAL_LOAD,
} from "./constants";
import { loadDerivedFollowUpSignals } from "./load-derived-signals";
import type {
  FollowUpCategory,
  FollowUpCounts,
  FollowUpItem,
  FollowUpStatus,
  FollowUpTab,
} from "./types";

export type FollowUpWorkspaceData = {
  tab: FollowUpTab;
  category: FollowUpCategory | "all";
  counts: FollowUpCounts;
  items: FollowUpItem[];
  page: number;
  pageSize: number;
  total: number;
  error: string | null;
};

function emptyRelated(): FollowUpItem["related"] {
  return {
    studentId: null,
    studentLabel: null,
    staffMemberId: null,
    staffLabel: null,
    classId: null,
    classLabel: null,
    parentRequestId: null,
    parentRequestLabel: null,
    transitionNoteId: null,
  };
}

function workspacePath(role: Role, path: string): string {
  return `/dashboard/${role}${path.startsWith("/") ? path : `/${path}`}`;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function displayStudentName(row: {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

function manualHref(
  role: Role,
  related: FollowUpItem["related"],
): string | null {
  if (related.parentRequestId) {
    return workspacePath(role, `/parent-requests/${related.parentRequestId}`);
  }
  if (related.studentId) {
    return workspacePath(role, `/students/${related.studentId}`);
  }
  if (related.staffMemberId) {
    return workspacePath(role, `/teachers/${related.staffMemberId}`);
  }
  if (related.classId) {
    return workspacePath(role, `/classes/${related.classId}`);
  }
  return null;
}

export function parseFollowUpSearchParams(
  raw: Record<string, string | string[] | undefined>,
): { tab: FollowUpTab; category: FollowUpCategory | "all"; page: number } {
  const tab = parseFollowUpTab(firstString(raw.tab));
  const category = parseFollowUpCategoryFilter(firstString(raw.category));
  const pageRaw = Number.parseInt(firstString(raw.page) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { tab, category, page };
}

export const loadManualFollowUps = cache(
  async (role: Role): Promise<{ items: FollowUpItem[]; error: string | null }> => {
    if (!isSupabaseConfigured()) {
      return { items: [], error: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .select(
        "id, title, note, category, status, due_on, created_by_profile_id, student_id, staff_member_id, class_id, parent_request_id, transition_note_id, source_type, source_id, created_at, completed_at",
      )
      .order("due_on", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) {
      logServerError("follow-up.manual", error.message);
      return { items: [], error: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const rows = data ?? [];
    const creatorIds = [...new Set(rows.map((r) => r.created_by_profile_id))];
    const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))] as string[];
    const staffIds = [...new Set(rows.map((r) => r.staff_member_id).filter(Boolean))] as string[];
    const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))] as string[];
    const requestIds = [
      ...new Set(rows.map((r) => r.parent_request_id).filter(Boolean)),
    ] as string[];

    const [profilesRes, studentsRes, staffRes, classesRes, requestsRes] = await Promise.all([
      creatorIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", creatorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
      studentIds.length
        ? supabase
            .from("students")
            .select("id, first_name, last_name, preferred_name")
            .in("id", studentIds)
        : Promise.resolve({ data: [] as const, error: null }),
      staffIds.length
        ? supabase.from("staff_members").select("id, full_name").in("id", staffIds)
        : Promise.resolve({ data: [] as const, error: null }),
      classIds.length
        ? supabase.from("classes").select("id, name, section").in("id", classIds)
        : Promise.resolve({ data: [] as const, error: null }),
      requestIds.length
        ? supabase
            .from("parent_record_requests")
            .select("id, requester_name")
            .in("id", requestIds)
        : Promise.resolve({ data: [] as const, error: null }),
    ]);

    const ownerById = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p.full_name?.trim() || "Leadership"]),
    );
    const studentById = new Map(
      (studentsRes.data ?? []).map((s) => [s.id, displayStudentName(s)]),
    );
    const staffById = new Map((staffRes.data ?? []).map((s) => [s.id, s.full_name]));
    const classById = new Map(
      (classesRes.data ?? []).map((c) => {
        const sec = c.section?.trim();
        return [c.id, sec ? `${c.name} · ${sec}` : c.name] as const;
      }),
    );
    const requestById = new Map(
      (requestsRes.data ?? []).map((r) => [r.id, r.requester_name]),
    );

    const items: FollowUpItem[] = rows.map((row) => {
      const category = isFollowUpCategory(row.category) ? row.category : "records";
      const status: FollowUpStatus = isFollowUpStatus(row.status) ? row.status : "open";
      const related: FollowUpItem["related"] = {
        ...emptyRelated(),
        studentId: row.student_id,
        studentLabel: row.student_id ? (studentById.get(row.student_id) ?? null) : null,
        staffMemberId: row.staff_member_id,
        staffLabel: row.staff_member_id ? (staffById.get(row.staff_member_id) ?? null) : null,
        classId: row.class_id,
        classLabel: row.class_id ? (classById.get(row.class_id) ?? null) : null,
        parentRequestId: row.parent_request_id,
        parentRequestLabel: row.parent_request_id
          ? (requestById.get(row.parent_request_id) ?? null)
          : null,
        transitionNoteId: row.transition_note_id,
      };
      return {
        id: row.id,
        kind: "manual",
        title: row.title,
        note: row.note,
        category,
        status,
        dueOn: row.due_on,
        ownerLabel: ownerById.get(row.created_by_profile_id) ?? "Leadership",
        href: manualHref(role, related),
        sourceType: row.source_type,
        sourceId: row.source_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        related,
      };
    });

    return { items, error: null };
  },
);

export const loadFollowUpWorkspace = cache(
  async (
    role: Role,
    searchParams: Record<string, string | string[] | undefined>,
  ): Promise<FollowUpWorkspaceData> => {
    const { tab, category, page } = parseFollowUpSearchParams(searchParams);
    const today = todayForFollowUp();
    const pageSize = tab === "completed" ? FOLLOW_UP_COMPLETED_PAGE_SIZE : FOLLOW_UP_PAGE_SIZE;

    const [manual, derived] = await Promise.all([
      loadManualFollowUps(role),
      loadDerivedFollowUpSignals(role, today),
    ]);

    const view = buildFollowUpWorkspaceView({
      items: [...manual.items, ...derived.items],
      tab,
      category,
      page,
      pageSize,
      today,
    });

    return {
      tab,
      category,
      counts: view.counts,
      items: view.items,
      page,
      pageSize,
      total: view.total,
      error: hasPartialFollowUpLoad(Boolean(manual.error), derived.failedSources.length)
        ? FOLLOW_UP_PARTIAL_LOAD
        : null,
    };
  },
);

export const loadOpenFollowUpsForStudent = cache(
  async (role: Role, studentId: string): Promise<FollowUpItem[]> => {
    const { items } = await loadManualFollowUps(role);
    return items
      .filter(
        (item) =>
          item.related.studentId === studentId && item.status !== "completed",
      )
      .slice(0, 5);
  },
);

export const loadOpenFollowUpsForStaff = cache(
  async (role: Role, staffMemberId: string): Promise<FollowUpItem[]> => {
    const { items } = await loadManualFollowUps(role);
    return items
      .filter(
        (item) =>
          item.related.staffMemberId === staffMemberId && item.status !== "completed",
      )
      .slice(0, 5);
  },
);

export const loadOpenFollowUpForParentRequest = cache(
  async (role: Role, parentRequestId: string): Promise<FollowUpItem | null> => {
    const { items } = await loadManualFollowUps(role);
    return (
      items.find(
        (item) =>
          item.related.parentRequestId === parentRequestId &&
          item.status !== "completed",
      ) ?? null
    );
  },
);

export const loadFollowUpTodayCount = cache(async (role: Role): Promise<number> => {
  const data = await loadFollowUpWorkspace(role, { tab: "my-day" });
  return data.counts.today;
});
