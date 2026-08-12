import {
  canAccessCalendar,
  canManageCalendarNotes,
  canViewCalendar,
  isLeadershipAuditRole,
  type Role,
} from "@/config/roles";

import type { CalendarEvent, EventAudience } from "./types";

export function isEventCategory(
  value: string,
): value is CalendarEvent["category"] {
  return (
    value === "school" ||
    value === "meeting" ||
    value === "academic" ||
    value === "reporting" ||
    value === "pd" ||
    value === "event" ||
    value === "deadline"
  );
}

export function isEventAudience(value: string): value is EventAudience {
  return value === "leadership" || value === "all_staff" || value === "whole_school";
}

/** Teachers (and later registrar) never see leadership-only events. */
export function canReadAudience(role: Role, audience: EventAudience): boolean {
  if (audience === "leadership") return isLeadershipAuditRole(role);
  if (audience === "all_staff" || audience === "whole_school") {
    return (
      role === "admin" ||
      role === "principal" ||
      role === "vice_principal" ||
      role === "teacher" ||
      role === "registrar"
    );
  }
  return false;
}

export function visibleEventsForRole<T extends { audience: EventAudience }>(
  role: Role,
  events: T[],
): T[] {
  return events.filter((event) => canReadAudience(role, event.audience));
}

export function canViewCalendarNotes(role: Role): boolean {
  return canManageCalendarNotes(role);
}

export function isCalendarWorkspaceRole(role: Role): boolean {
  return canViewCalendar(role);
}

/** Create / edit / archive events — leadership only. */
export function canManageCalendarEvents(role: Role): boolean {
  return canAccessCalendar(role);
}

export function unauthorizedCalendarMessage(role: Role): string {
  if (role === "teacher") {
    return "Teachers cannot open the leadership calendar.";
  }
  if (role === "registrar") {
    return "The school calendar is managed by leadership.";
  }
  return "You cannot open the calendar.";
}
