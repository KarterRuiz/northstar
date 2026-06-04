import "server-only";

import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import type { AssignmentProfileRow } from "./load-assignment-profiles";
import {
  isParentRequestStatus,
  type ParentRequestStatus,
} from "./constants";

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
};

export type ParentRequestListRow = {
  id: string;
  student_id: string;
  status: ParentRequestStatus;
  requester_name: string;
  requester_email: string;
  requester_relationship: string;
  requested_documents: string[];
  assigned_to_profile_id: string | null;
  details: string | null;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
  student: StudentEmbed | null;
};

async function studentIdsMatchingSearch(raw: string): Promise<string[]> {
  const q = raw.trim().slice(0, 160);
  if (q.length === 0) return [];

  const esc = escapeIlikePattern(q);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .or(
      `first_name.ilike.%${esc}%,last_name.ilike.%${esc}%,external_id.ilike.%${esc}%`,
    )
    .limit(400);

  if (error || !data) return [];
  return [...new Set(data.map((r) => r.id))];
}

export type ParentRequestListResult =
  | { ok: true; rows: ParentRequestListRow[] }
  | { ok: false; message: string };

export async function loadStudentQuickLabelForRequestForm(
  studentId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select("first_name, last_name, preferred_name, external_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !data) return null;
  const pref = data.preferred_name?.trim();
  const base = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  const display = pref || base || "Student";
  const ext = data.external_id?.trim();
  return ext ? `${display} (#${ext})` : display;
}

export const loadParentRequestsList = cache(
  async (opts: {
    status?: ParentRequestStatus;
    studentSearch?: string;
  }): Promise<ParentRequestListResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();

    let studentIds: string[] | undefined;
    if (opts.studentSearch?.trim()) {
      studentIds = await studentIdsMatchingSearch(opts.studentSearch);
      if (studentIds.length === 0) {
        return { ok: true, rows: [] };
      }
    }

    let query = supabase
      .from("parent_record_requests")
      .select(
        `
        id,
        student_id,
        status,
        requester_name,
        requester_email,
        requester_relationship,
        requested_documents,
        assigned_to_profile_id,
        details,
        staff_notes,
        created_at,
        updated_at
      `,
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (opts.status) {
      query = query.eq("status", opts.status);
    }

    if (studentIds) {
      query = query.in("student_id", studentIds);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, message: error.message };
    }

    const reqRows = data ?? [];
    const sidSet = [...new Set(reqRows.map((r) => r.student_id))];
    const studentMap = new Map<string, StudentEmbed>();

    if (sidSet.length > 0) {
      const { data: studs, error: studErr } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name, external_id")
        .in("id", sidSet);

      if (studErr) {
        return { ok: false, message: studErr.message };
      }
      for (const s of studs ?? []) {
        studentMap.set(s.id, s as StudentEmbed);
      }
    }

    const rows: ParentRequestListRow[] = reqRows.map((row) => {
      const student = studentMap.get(row.student_id) ?? null;
      const st = row.status as string;
      const status = isParentRequestStatus(st) ? st : "received";
      return {
        id: row.id,
        student_id: row.student_id,
        status,
        requester_name: row.requester_name,
        requester_email: row.requester_email,
        requester_relationship: row.requester_relationship ?? "",
        requested_documents: Array.isArray(row.requested_documents)
          ? row.requested_documents
          : [],
        assigned_to_profile_id: row.assigned_to_profile_id ?? null,
        details: row.details ?? null,
        staff_notes: row.staff_notes ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        student,
      };
    });

    return { ok: true, rows };
  },
);

export type ParentRequestDetailRow = ParentRequestListRow;

export async function loadParentRequestById(
  id: string,
): Promise<
  | { ok: true; row: ParentRequestDetailRow; handler: AssignmentProfileRow | null }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("parent_record_requests")
    .select(
      `
        id,
        student_id,
        status,
        requester_name,
        requester_email,
        requester_relationship,
        requested_documents,
        assigned_to_profile_id,
        details,
        staff_notes,
        created_at,
        updated_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: "Request not found." };
  }

  let student: StudentEmbed | null = null;
  const { data: stu, error: stuErr } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .eq("id", data.student_id)
    .maybeSingle();

  if (stuErr) {
    return { ok: false, message: stuErr.message };
  }
  if (stu) {
    student = stu as StudentEmbed;
  }

  const st = data.status as string;
  const status = isParentRequestStatus(st) ? st : "received";

  const row: ParentRequestDetailRow = {
    id: data.id,
    student_id: data.student_id,
    status,
    requester_name: data.requester_name,
    requester_email: data.requester_email,
    requester_relationship: data.requester_relationship ?? "",
    requested_documents: Array.isArray(data.requested_documents)
      ? data.requested_documents
      : [],
    assigned_to_profile_id: data.assigned_to_profile_id ?? null,
    details: data.details ?? null,
    staff_notes: data.staff_notes ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    student,
  };

  let handler: AssignmentProfileRow | null = null;
  if (data.assigned_to_profile_id) {
    const { data: hp } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", data.assigned_to_profile_id)
      .maybeSingle();
    if (hp) {
      handler = hp as AssignmentProfileRow;
    }
  }

  return { ok: true, row, handler };
}
