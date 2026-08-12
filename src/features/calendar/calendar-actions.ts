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
import { canManageCalendarNotes } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";

import { instantsFromDraft } from "./calendar-range";
import { canAccessCalendar } from "./require-calendar-actor";
import { isIsoDate } from "./school-timezone";
import type { EventAudience, EventCategory } from "./types";
import { isEventAudience, isEventCategory } from "./visibility";

export type CalendarActionState =
  | { ok: true; message: string; eventId?: string; noteId?: string }
  | { ok: false; message: string };

async function requireActor() {
  if (!isSupabaseConfigured()) {
    return { ok: false as const, message: "Calendar is unavailable right now." };
  }
  const user = await getUser();
  if (!user) return { ok: false as const, message: "Please sign in again." };
  const role = await getProfileRole(user.id);
  if (!role || !canAccessCalendar(role)) {
    return { ok: false as const, message: "You cannot manage the school calendar." };
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

function revalidateCalendar(role: string) {
  revalidatePath(`/dashboard/${role}/calendar`);
  revalidatePath(`/dashboard/${role}`);
}

function readEventDraft(formData: FormData) {
  const categoryRaw = trimMax(formData.get("category"), 32);
  const audienceRaw = trimMax(formData.get("audience"), 32);
  const category: EventCategory = isEventCategory(categoryRaw) ? categoryRaw : "school";
  const audience: EventAudience = isEventAudience(audienceRaw) ? audienceRaw : "all_staff";
  return {
    title: trimMax(formData.get("title"), 160),
    description: trimMax(formData.get("description"), 2000),
    startDate: trimMax(formData.get("startDate"), 10),
    endDate: trimMax(formData.get("endDate"), 10),
    allDay: String(formData.get("allDay") ?? "") !== "false",
    startTime: trimMax(formData.get("startTime"), 5),
    endTime: trimMax(formData.get("endTime"), 5),
    category,
    audience,
    location: trimMax(formData.get("location"), 160),
  };
}

export async function createSchoolEventAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const draft = readEventDraft(formData);
  if (!draft.title) return { ok: false, message: "Add a title." };

  const instants = instantsFromDraft(draft);
  if ("error" in instants) return { ok: false, message: instants.error };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("school_events")
    .insert({
      title: draft.title,
      description: draft.description || null,
      starts_at: instants.startsAt,
      ends_at: instants.endsAt,
      all_day: draft.allDay,
      category: draft.category,
      audience: draft.audience,
      location: draft.location || null,
      created_by_profile_id: actor.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("calendar.createEvent", error?.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error?.message, "Could not save this event."),
    };
  }

  await recordAuditEvent({
    action: "calendar_event_created",
    actorUserId: actor.userId,
    metadata: {
      eventId: data.id,
      title: draft.title,
      category: draft.category,
      audience: draft.audience,
      allDay: draft.allDay,
      startsAt: instants.startsAt,
      endsAt: instants.endsAt,
    },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Event saved.", eventId: data.id };
}

export async function updateSchoolEventAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("eventId"));
  if (!id) return { ok: false, message: "This event could not be found." };

  const draft = readEventDraft(formData);
  if (!draft.title) return { ok: false, message: "Add a title." };

  const instants = instantsFromDraft(draft);
  if ("error" in instants) return { ok: false, message: instants.error };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("school_events")
    .update({
      title: draft.title,
      description: draft.description || null,
      starts_at: instants.startsAt,
      ends_at: instants.endsAt,
      all_day: draft.allDay,
      category: draft.category,
      audience: draft.audience,
      location: draft.location || null,
    })
    .eq("id", id)
    .is("archived_at", null);

  if (error) {
    logServerError("calendar.updateEvent", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not update this event."),
    };
  }

  await recordAuditEvent({
    action: "calendar_event_updated",
    actorUserId: actor.userId,
    metadata: {
      eventId: id,
      title: draft.title,
      category: draft.category,
      audience: draft.audience,
      allDay: draft.allDay,
      startsAt: instants.startsAt,
      endsAt: instants.endsAt,
    },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Event updated.", eventId: id };
}

export async function archiveSchoolEventAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;

  const id = optionalUuid(formData.get("eventId"));
  if (!id) return { ok: false, message: "This event could not be found." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("school_events")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id, title")
    .maybeSingle();

  if (error) {
    logServerError("calendar.archiveEvent", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not archive this event."),
    };
  }
  if (!data) return { ok: false, message: "This event could not be found." };

  await recordAuditEvent({
    action: "calendar_event_archived",
    actorUserId: actor.userId,
    metadata: { eventId: data.id, title: data.title },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Event archived.", eventId: data.id };
}

function readNoteRelated(formData: FormData) {
  return {
    staffMemberId: optionalUuid(formData.get("staffMemberId")),
    studentId: optionalUuid(formData.get("studentId")),
    classId: optionalUuid(formData.get("classId")),
  };
}

export async function createCalendarNoteAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;
  if (!canManageCalendarNotes(actor.role)) {
    return { ok: false, message: "You cannot add leadership notes." };
  }

  const note = trimMax(formData.get("note"), 2000);
  if (!note) return { ok: false, message: "Add a note." };
  const noteDate = trimMax(formData.get("noteDate"), 10);
  if (!isIsoDate(noteDate)) return { ok: false, message: "Choose a date." };
  const related = readNoteRelated(formData);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("calendar_notes")
    .insert({
      note,
      note_date: noteDate,
      created_by_profile_id: actor.userId,
      related_staff_member_id: related.staffMemberId,
      related_student_id: related.studentId,
      related_class_id: related.classId,
    })
    .select("id")
    .single();

  if (error || !data) {
    logServerError("calendar.createNote", error?.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error?.message, "Could not save this note."),
    };
  }

  await recordAuditEvent({
    action: "calendar_note_created",
    actorUserId: actor.userId,
    metadata: {
      noteId: data.id,
      noteDate,
      staffMemberId: related.staffMemberId,
      studentId: related.studentId,
      classId: related.classId,
    },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Note saved.", noteId: data.id };
}

export async function updateCalendarNoteAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;
  if (!canManageCalendarNotes(actor.role)) {
    return { ok: false, message: "You cannot edit leadership notes." };
  }

  const id = optionalUuid(formData.get("noteId"));
  if (!id) return { ok: false, message: "This note could not be found." };
  const note = trimMax(formData.get("note"), 2000);
  if (!note) return { ok: false, message: "Add a note." };
  const noteDate = trimMax(formData.get("noteDate"), 10);
  if (!isIsoDate(noteDate)) return { ok: false, message: "Choose a date." };
  const related = readNoteRelated(formData);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("calendar_notes")
    .update({
      note,
      note_date: noteDate,
      related_staff_member_id: related.staffMemberId,
      related_student_id: related.studentId,
      related_class_id: related.classId,
    })
    .eq("id", id);

  if (error) {
    logServerError("calendar.updateNote", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not update this note."),
    };
  }

  await recordAuditEvent({
    action: "calendar_note_updated",
    actorUserId: actor.userId,
    metadata: { noteId: id, noteDate },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Note updated.", noteId: id };
}

export async function deleteCalendarNoteAction(
  _prev: CalendarActionState | undefined,
  formData: FormData,
): Promise<CalendarActionState> {
  const actor = await requireActor();
  if (!actor.ok) return actor;
  if (!canManageCalendarNotes(actor.role)) {
    return { ok: false, message: "You cannot delete leadership notes." };
  }

  const id = optionalUuid(formData.get("noteId"));
  if (!id) return { ok: false, message: "This note could not be found." };
  const noteDate = trimMax(formData.get("noteDate"), 10);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("calendar_notes").delete().eq("id", id);

  if (error) {
    logServerError("calendar.deleteNote", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(error.message, "Could not delete this note."),
    };
  }

  await recordAuditEvent({
    action: "calendar_note_deleted",
    actorUserId: actor.userId,
    metadata: {
      noteId: id,
      ...(isIsoDate(noteDate) ? { noteDate } : {}),
    },
  });

  revalidateCalendar(actor.role);
  return { ok: true, message: "Note deleted.", noteId: id };
}
