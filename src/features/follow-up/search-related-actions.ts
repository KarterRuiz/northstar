"use server";

import { getProfileRole, getUser } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { canAccessFollowUp } from "./require-follow-up-actor";

export type FollowUpSearchOption = {
  id: string;
  label: string;
  meta?: string | null;
};

export type FollowUpSearchResult =
  | { ok: true; options: FollowUpSearchOption[] }
  | { ok: false; message: string };

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function requireSearch() {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, message: "Search is unavailable right now." };
  }
  const user = await getUser();
  if (!user) return { ok: false as const, message: "Please sign in again." };
  const role = await getProfileRole(user.id);
  if (!role || !canAccessFollowUp(role)) {
    return { ok: false as const, message: "You cannot search from Follow-Up." };
  }
  return { ok: true as const };
}

export async function searchFollowUpStudentsAction(
  rawQuery: string,
): Promise<FollowUpSearchResult> {
  const gate = await requireSearch();
  if (!gate.ok) return gate;

  const q = rawQuery.trim().slice(0, 160);
  if (q.length < 2) return { ok: true, options: [] };

  const like = `%${escapeIlike(q)}%`;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .or(
      `first_name.ilike.${like},last_name.ilike.${like},preferred_name.ilike.${like},external_id.ilike.${like}`,
    )
    .limit(12);

  if (error) {
    logServerError("follow-up.searchStudents", error.message);
    return { ok: false, message: "We couldn’t search students right now." };
  }

  return {
    ok: true,
    options: (data ?? []).map((row) => {
      const pref = row.preferred_name?.trim();
      const name =
        pref ||
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        "Student";
      return {
        id: row.id,
        label: name,
        meta: row.external_id?.trim() ? `#${row.external_id.trim()}` : null,
      };
    }),
  };
}

export async function searchFollowUpStaffAction(
  rawQuery: string,
): Promise<FollowUpSearchResult> {
  const gate = await requireSearch();
  if (!gate.ok) return gate;

  const q = rawQuery.trim().slice(0, 160);
  if (q.length < 2) return { ok: true, options: [] };

  const like = `%${escapeIlike(q)}%`;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, full_name, email, role")
    .is("archived_at", null)
    .or(`full_name.ilike.${like},email.ilike.${like}`)
    .limit(12);

  if (error) {
    logServerError("follow-up.searchStaff", error.message);
    return { ok: false, message: "We couldn’t search staff right now." };
  }

  return {
    ok: true,
    options: (data ?? []).map((row) => ({
      id: row.id,
      label: row.full_name,
      meta: row.email?.trim() || row.role,
    })),
  };
}

export async function searchFollowUpClassesAction(
  rawQuery: string,
): Promise<FollowUpSearchResult> {
  const gate = await requireSearch();
  if (!gate.ok) return gate;

  const q = rawQuery.trim().slice(0, 160);
  if (q.length < 2) return { ok: true, options: [] };

  const like = `%${escapeIlike(q)}%`;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section")
    .eq("is_active", true)
    .ilike("name", like)
    .limit(12);

  if (error) {
    logServerError("follow-up.searchClasses", error.message);
    return { ok: false, message: "We couldn’t search classes right now." };
  }

  return {
    ok: true,
    options: (data ?? []).map((row) => {
      const sec = row.section?.trim();
      return {
        id: row.id,
        label: sec ? `${row.name} · ${sec}` : row.name,
      };
    }),
  };
}

export async function searchFollowUpParentRequestsAction(
  rawQuery: string,
): Promise<FollowUpSearchResult> {
  const gate = await requireSearch();
  if (!gate.ok) return gate;

  const q = rawQuery.trim().slice(0, 160);
  if (q.length < 2) return { ok: true, options: [] };

  const like = `%${escapeIlike(q)}%`;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("parent_record_requests")
    .select("id, requester_name, status")
    .in("status", ["received", "approved"])
    .ilike("requester_name", like)
    .limit(12);

  if (error) {
    logServerError("follow-up.searchRequests", error.message);
    return { ok: false, message: "We couldn’t search parent requests right now." };
  }

  return {
    ok: true,
    options: (data ?? []).map((row) => ({
      id: row.id,
      label: row.requester_name,
      meta: row.status,
    })),
  };
}
