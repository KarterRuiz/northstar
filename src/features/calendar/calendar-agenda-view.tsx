"use client";

import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { CalendarDays } from "lucide-react";

import { buildAgendaGroups, formatEventWhen } from "./calendar-range";
import { CategoryChip } from "./category-chip";
import { AGENDA_HORIZON_DAYS, CALENDAR_EMPTY } from "./constants";
import { addSchoolDays } from "./school-timezone";
import type { CalendarEvent, CalendarNote } from "./types";

export function CalendarAgendaView({
  events,
  notes,
  canManageNotes,
  todayIso,
  onSelectDay,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  notes: CalendarNote[];
  canManageNotes: boolean;
  todayIso: string;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (iso: string, eventId: string) => void;
}) {
  const groups = buildAgendaGroups({
    events,
    notes: canManageNotes ? notes : [],
    fromIso: todayIso,
    toIso: addSchoolDays(todayIso, AGENDA_HORIZON_DAYS),
    todayIso,
  });

  if (groups.length === 0) {
    return (
      <ListEmptyState
        icon={CalendarDays}
        title={CALENDAR_EMPTY.agenda}
        description="Add a school event when the date is known."
      />
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.iso} className="space-y-2" aria-labelledby={`agenda-${group.iso}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={`agenda-${group.iso}`} className="text-heading text-sm font-semibold">
              {group.label}
              {group.isToday ? (
                <span className="text-muted-foreground ml-2 text-xs font-medium">Today</span>
              ) : null}
            </h3>
            <button
              type="button"
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
              onClick={() => onSelectDay(group.iso)}
            >
              Open day
            </button>
          </div>
          <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {group.events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(group.iso, event.id)}
                  className="hover:bg-row-hover flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-heading text-sm font-medium">{event.title}</p>
                    <p className="ns-meta mt-0.5">{formatEventWhen(event, todayIso)}</p>
                    {event.location ? (
                      <p className="ns-muted mt-0.5 text-xs">{event.location}</p>
                    ) : null}
                  </div>
                  <CategoryChip category={event.category} />
                </button>
              </li>
            ))}
            {group.notes.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectDay(group.iso)}
                  className="hover:bg-row-hover w-full px-3.5 py-3 text-left"
                >
                  <p className="ns-meta">Leadership note</p>
                  <p className="text-heading mt-0.5 line-clamp-2 text-sm">{item.note}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
