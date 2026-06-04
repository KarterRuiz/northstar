"use server";

import { revalidatePath } from "next/cache";

import {
  canManageParentRecordRequests,
  isRole,
} from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";

import {
  PARENT_REQUEST_DOCUMENT_IDS,
  isParentRequestStatus,
  type ParentRequestDocumentId,
  type ParentRequestStatus,
} from "./constants";
import { requireParentRecordsActor } from "./require-parent-records-actor";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimMax(value: unknown, max: number): string {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function parseDocuments(formData: FormData): ParentRequestDocumentId[] {
  const keys = formData.getAll("documents") as string[];
  const out: ParentRequestDocumentId[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const id = String(k ?? "").trim();
    if (!PARENT_REQUEST_DOCUMENT_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as ParentRequestDocumentId);
  }
  return out;
}

export type ParentRequestMutationState =
  | { ok: true; message?: string; requestId?: string }
  | { ok: false; message: string };

export async function searchStudentsForParentRequestAction(
  rawQuery: string,
): Promise<
  | { ok: true; students: { id: string; label: string }[] }
  | { ok: false; message: string }
> {
  const gate = await requireParentRecordsActor();
  if (!gate.ok) return { ok: false, message: gate.error };

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const q = trimMax(rawQuery, 160);
  if (q.length < 2) {
    return { ok: true, students: [] };
  }

  const esc = escapeIlikePattern(q);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .or(
      `first_name.ilike.%${esc}%,last_name.ilike.%${esc}%,external_id.ilike.%${esc}%`,
    )
    .limit(25);

  if (error) {
    return { ok: false, message: error.message };
  }

  const students = (data ?? []).map((s) => {
    const pref = s.preferred_name?.trim();
    const base = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
    const display = pref || base || "Student";
    const ext = s.external_id?.trim();
    const label = ext ? `${display} (#${ext})` : display;
    return { id: s.id, label };
  });

  return { ok: true, students };
}

export async function createParentRecordRequestAction(
  _prev: ParentRequestMutationState | undefined,
  formData: FormData,
): Promise<ParentRequestMutationState> {
  void _prev;

  const gate = await requireParentRecordsActor();
  if (!gate.ok) return { ok: false, message: gate.error };

  const studentId = trimMax(formData.get("student_id"), 80);
  const requesterName = trimMax(formData.get("requester_name"), 200);
  const requesterEmail = trimMax(formData.get("requester_email"), 320);
  const relationship = trimMax(formData.get("requester_relationship"), 160);
  const details = trimMax(formData.get("details"), 8000);
  const statusRaw = trimMax(formData.get("status"), 40);
  const assignedRaw = trimMax(formData.get("assigned_to_profile_id"), 80);

  if (!isUuid(studentId)) {
    return { ok: false, message: "Choose a valid student." };
  }
  if (requesterName.length === 0) {
    return { ok: false, message: "Requester name is required." };
  }
  if (requesterEmail.length === 0 || !requesterEmail.includes("@")) {
    return { ok: false, message: "Requester email must look valid." };
  }
  if (relationship.length === 0) {
    return { ok: false, message: "Relationship is required." };
  }

  const status: ParentRequestStatus = isParentRequestStatus(statusRaw)
    ? statusRaw
    : "received";

  const documents = parseDocuments(formData);
  const assigned =
    assignedRaw.length > 0 && isUuid(assignedRaw) ? assignedRaw : null;

  const { error, data } = await gate.supabase
    .from("parent_record_requests")
    .insert({
      student_id: studentId,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_relationship: relationship,
      requested_documents: documents,
      details: details.length > 0 ? details : null,
      status,
      assigned_to_profile_id: assigned,
      submitted_by_profile_id: gate.userId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }

  await recordAuditEvent({
    action: "parent_request_created",
    metadata: {
      requestId: data?.id ?? "",
      studentId,
      status,
      documentCount: documents.length,
    },
    actorUserId: gate.userId,
  });

  const dr = trimMax(formData.get("dashboardRole"), 40);
  const rolePath =
    isRole(dr) && canManageParentRecordRequests(dr) ? dr : gate.role;

  revalidatePath(`/dashboard/${rolePath}/parent-requests`);

  return {
    ok: true,
    message: "Request saved.",
    requestId: data?.id,
  };
}

export async function updateParentRecordRequestAction(
  _prev: ParentRequestMutationState | undefined,
  formData: FormData,
): Promise<ParentRequestMutationState> {
  void _prev;

  const gate = await requireParentRecordsActor();
  if (!gate.ok) return { ok: false, message: gate.error };

  const requestId = trimMax(formData.get("request_id"), 80);
  if (!isUuid(requestId)) {
    return { ok: false, message: "Missing request id." };
  }

  const { data: existing, error: loadErr } = await gate.supabase
    .from("parent_record_requests")
    .select("id, student_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, message: loadErr?.message ?? "Request not found." };
  }

  const prevStatus = String(existing.status ?? "");

  const statusRaw = trimMax(formData.get("status"), 40);
  const status: ParentRequestStatus = isParentRequestStatus(statusRaw)
    ? statusRaw
    : "received";

  const assignedRaw = trimMax(formData.get("assigned_to_profile_id"), 80);
  const assigned =
    assignedRaw.length > 0 && isUuid(assignedRaw) ? assignedRaw : null;

  const staffNotes = trimMax(formData.get("staff_notes"), 8000);
  const details = trimMax(formData.get("details"), 8000);

  const patch: Database["public"]["Tables"]["parent_record_requests"]["Update"] =
    {
      status,
      assigned_to_profile_id: assigned,
      staff_notes: staffNotes.length > 0 ? staffNotes : null,
      details: details.length > 0 ? details : null,
    };

  const { error } = await gate.supabase
    .from("parent_record_requests")
    .update(patch)
    .eq("id", requestId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await recordAuditEvent({
    action: "parent_request_updated",
    metadata: {
      requestId,
      studentId: existing.student_id,
      status,
      previousStatus: prevStatus,
    },
    actorUserId: gate.userId,
  });

  if (status === "completed" && prevStatus !== "completed") {
    await recordAuditEvent({
      action: "parent_request_completed",
      metadata: {
        requestId,
        studentId: existing.student_id,
      },
      actorUserId: gate.userId,
    });
  }

  const dr = trimMax(formData.get("dashboardRole"), 40);
  const rolePath =
    isRole(dr) && canManageParentRecordRequests(dr) ? dr : gate.role;

  revalidatePath(`/dashboard/${rolePath}/parent-requests`);
  revalidatePath(`/dashboard/${rolePath}/parent-requests/${requestId}`);

  return { ok: true, message: "Request updated." };
}