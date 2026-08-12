"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import {
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

import {
  isFollowUpCategory,
  rescheduleDueOn,
  todayForFollowUp,
} from "./classify";
import { canAccessFollowUp } from "./require-follow-up-actor";
import { getProfileRole, getUser } from "@/lib/auth/session";
import type { FollowUpCategory, FollowUpStatus } from "./types";

export type FollowUpActionState =
  | { ok: true; message: string; followUpId?: string }
  | { ok: false; message: string };

async function requireActor() {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, message: "Follow-up is unavailable right now." };
  }
  const user = await getUser();
  if (!user) return { ok: false as const, message: "Please sign in again." };
  const role = await getProfileRole(user.id);
  if (!role || !canAccessFollowUp(role)) {
    return { ok: false as const, message: "You cannot manage follow-ups." };
  }
  return { ok: true as const, userId: user.id, role };
}

function trimMax(value: unknown, max: number): string {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function optionalUuid(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return isUuid(s) ? s : null;
}

function optionalDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function revalidateFollowUp(role: string, related?: {
  studentId?: string | null;
  staffMemberId?: string | null;
  parentRequestId?: string | null;
}) {
  revalidatePath(`/dashboard/${role}/follow-up`);
  revalidatePath(`/dashboard/${role}`);
  if (related?.studentId) {
    revalidatePath(`/dashboard/${role}/students/${related.studentId}`);
  }
  if (related?.staffMemberId) {
    revalidatePath(`/dashboard/${role}/teachers/${related.staffMemberId}`);
  }
  if (related?.parentRequestId) {
    revalidatePath(`/dashboard/${role}/parent-requests/${related.parentRequestId}`);
  }
}

function readRelated(formData: FormData) {
  return {
    studentId: optionalUuid(formData.get("studentId")),
    staffMemberId: optionalUuid(formData.get("staffMemberId")),
    classId: optionalUuid(formData.get("classId")),
    parentRequestId: optionalUuid(formData.get("parentRequestId")),
  };
}

export async function createFollowUpAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const title = trimMax(formData.get("title"), 160);
  if (!title) return { ok: false, message: "Add a title." };

  const note = trimMax(formData.get("note"), 2000) || null;
  const categoryRaw = trimMax(formData.get("category"), 32);
  const category: FollowUpCategory = isFollowUpCategory(categoryRaw)
    ? categoryRaw
    : "records";
  const dueOn = optionalDate(formData.get("dueOn"));
  const related = readRelated(formData);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      title,
      note,
      category,
      status: "open",
      due_on: dueOn,
      created_by_profile_id: actor.userId,
      student_id: related.studentId,
      staff_member_id: related.staffMemberId,
      class_id: related.classId,
      parent_request_id: related.parentRequestId,
      source_type: "manual",
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("follow-up.create", error?.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error?.message, "Could not save this follow-up."),
    };
  }

  await recordAuditEvent({
    action: "follow_up_created",
    actorUserId: actor.userId,
    metadata: {
      followUpId: data.id,
      category,
      studentId: related.studentId,
      staffMemberId: related.staffMemberId,
      parentRequestId: related.parentRequestId,
    },
  });

  revalidateFollowUp(actor.role, related);
  return { ok: true, message: "Follow-up saved.", followUpId: data.id };
}

export async function updateFollowUpAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("followUpId"));
  if (!id) return { ok: false, message: "This follow-up could not be found." };

  const title = trimMax(formData.get("title"), 160);
  if (!title) return { ok: false, message: "Add a title." };

  const note = trimMax(formData.get("note"), 2000) || null;
  const categoryRaw = trimMax(formData.get("category"), 32);
  const category: FollowUpCategory = isFollowUpCategory(categoryRaw)
    ? categoryRaw
    : "records";
  const statusRaw = trimMax(formData.get("status"), 32);
  const status: FollowUpStatus =
    statusRaw === "waiting" || statusRaw === "open" ? statusRaw : "open";
  const dueOn = optionalDate(formData.get("dueOn"));
  const related = readRelated(formData);

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: loadError } = await supabase
    .from("follow_ups")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    logServerError("follow-up.update.load", loadError?.message);
    return { ok: false, message: "This follow-up could not be found." };
  }

  const { error } = await supabase
    .from("follow_ups")
    .update({
      title,
      note,
      category,
      status,
      due_on: dueOn,
      student_id: related.studentId,
      staff_member_id: related.staffMemberId,
      class_id: related.classId,
      parent_request_id: related.parentRequestId,
      completed_at: null,
      completed_by_profile_id: null,
    })
    .eq("id", id);

  if (error) {
    logServerError("follow-up.update", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not update this follow-up."),
    };
  }

  const reopened = existing.status === "completed";
  await recordAuditEvent({
    action: reopened ? "follow_up_reopened" : "follow_up_updated",
    actorUserId: actor.userId,
    metadata: { followUpId: id, category, status },
  });

  revalidateFollowUp(actor.role, related);
  return { ok: true, message: reopened ? "Follow-up reopened." : "Follow-up updated." };
}

export async function completeFollowUpAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("followUpId"));
  if (!id) return { ok: false, message: "This follow-up could not be found." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("follow_ups")
    .select("id, student_id, staff_member_id, parent_request_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "This follow-up could not be found." };

  const { error } = await supabase
    .from("follow_ups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by_profile_id: actor.userId,
    })
    .eq("id", id);

  if (error) {
    logServerError("follow-up.complete", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not complete this follow-up."),
    };
  }

  await recordAuditEvent({
    action: "follow_up_completed",
    actorUserId: actor.userId,
    metadata: { followUpId: id },
  });

  revalidateFollowUp(actor.role, {
    studentId: existing.student_id,
    staffMemberId: existing.staff_member_id,
    parentRequestId: existing.parent_request_id,
  });
  return { ok: true, message: "Marked complete." };
}

export async function setFollowUpWaitingAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("followUpId"));
  if (!id) return { ok: false, message: "This follow-up could not be found." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({
      status: "waiting",
      completed_at: null,
      completed_by_profile_id: null,
    })
    .eq("id", id);

  if (error) {
    logServerError("follow-up.waiting", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not update this follow-up."),
    };
  }

  await recordAuditEvent({
    action: "follow_up_updated",
    actorUserId: actor.userId,
    metadata: { followUpId: id, status: "waiting" },
  });

  revalidateFollowUp(actor.role);
  return { ok: true, message: "Marked as waiting." };
}

export async function rescheduleFollowUpAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("followUpId"));
  if (!id) return { ok: false, message: "This follow-up could not be found." };

  const choice = trimMax(formData.get("reschedule"), 32);
  const chosen = optionalDate(formData.get("dueOn"));
  const today = todayForFollowUp();
  const dueOn =
    choice === "tomorrow" || choice === "next_week"
      ? rescheduleDueOn(today, choice)
      : chosen;
  if (!dueOn) return { ok: false, message: "Choose a date." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ due_on: dueOn })
    .eq("id", id);

  if (error) {
    logServerError("follow-up.reschedule", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not reschedule this follow-up."),
    };
  }

  await recordAuditEvent({
    action: "follow_up_updated",
    actorUserId: actor.userId,
    metadata: { followUpId: id, dueOn },
  });

  revalidateFollowUp(actor.role);
  return { ok: true, message: "Rescheduled." };
}

export async function reopenFollowUpAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("followUpId"));
  if (!id) return { ok: false, message: "This follow-up could not be found." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("follow_ups")
    .select("id, student_id, staff_member_id, parent_request_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, message: "This follow-up could not be found." };

  const { error } = await supabase
    .from("follow_ups")
    .update({
      status: "open",
      completed_at: null,
      completed_by_profile_id: null,
    })
    .eq("id", id);

  if (error) {
    logServerError("follow-up.reopen", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not reopen this follow-up."),
    };
  }

  await recordAuditEvent({
    action: "follow_up_reopened",
    actorUserId: actor.userId,
    metadata: { followUpId: id },
  });

  revalidateFollowUp(actor.role, {
    studentId: existing.student_id,
    staffMemberId: existing.staff_member_id,
    parentRequestId: existing.parent_request_id,
  });
  return { ok: true, message: "Returned to open." };
}

export async function setParentRequestFollowUpDateAction(
  _prev: FollowUpActionState | undefined,
  formData: FormData,
): Promise<FollowUpActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const parentRequestId = optionalUuid(formData.get("parentRequestId"));
  const dueOn = optionalDate(formData.get("dueOn"));
  if (!parentRequestId) return { ok: false, message: "This request could not be found." };
  if (!dueOn) return { ok: false, message: "Choose a follow-up date." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("parent_request_id", parentRequestId)
    .neq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follow_ups")
      .update({ due_on: dueOn })
      .eq("id", existing.id);
    if (error) {
      logServerError("follow-up.parentDate.update", error.message);
      return { ok: false, message: "Could not set that date." };
    }
    await recordAuditEvent({
      action: "follow_up_updated",
      actorUserId: actor.userId,
      metadata: { followUpId: existing.id, parentRequestId, dueOn },
    });
    revalidateFollowUp(actor.role, { parentRequestId });
    return { ok: true, message: "Follow-up date updated." };
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      title: "Parent request follow-up",
      category: "families",
      status: "waiting",
      due_on: dueOn,
      created_by_profile_id: actor.userId,
      parent_request_id: parentRequestId,
      source_type: "manual",
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("follow-up.parentDate.create", error?.message);
    return { ok: false, message: "Could not set that date." };
  }

  await recordAuditEvent({
    action: "follow_up_created",
    actorUserId: actor.userId,
    metadata: { followUpId: data.id, parentRequestId, dueOn },
  });
  revalidateFollowUp(actor.role, { parentRequestId });
  return { ok: true, message: "Follow-up date set." };
}
