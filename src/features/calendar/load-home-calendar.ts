import "server-only";

import type { Role } from "@/config/roles";
import { logServerError } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { mapStoredEvent, upcomingHomeEvents } from "./calendar-range";
import { HOME_UPCOMING_LIMIT } from "./constants";
import { schoolAllDayStartIso, schoolTodayIso } from "./school-timezone";
import type { HomeCalendarEvent } from "./types";
import { canViewCalendar } from "./require-calendar-actor";
import { visibleEventsForRole } from "./visibility";

export type HomeCalendarData = {
  todayIso: string;
  events: HomeCalendarEvent[];
  error: string | null;
};

export async function loadHomeCalendarPreview(
  role: Role,
): Promise<HomeCalendarData> {
  const todayIso = schoolTodayIso();
  const empty: HomeCalendarData = { todayIso, events: [], error: null };

  if (!canViewCalendar(role) || !isSupabaseConfigured()) {
    return empty;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("school_events")
    .select(
      "id, title, description, starts_at, ends_at, all_day, category, audience, location, created_by_profile_id",
    )
    .is("archived_at", null)
    .gte("ends_at", schoolAllDayStartIso(todayIso))
    .order("starts_at", { ascending: true })
    .limit(12);

  if (error) {
    logServerError("calendar.homePreview", error.message);
    return { ...empty, error: "Calendar could not be loaded right now." };
  }

  const mapped = visibleEventsForRole(role, (data ?? []).map(mapStoredEvent));
  return {
    todayIso,
    events: upcomingHomeEvents(mapped, todayIso, HOME_UPCOMING_LIMIT),
    error: null,
  };
}
