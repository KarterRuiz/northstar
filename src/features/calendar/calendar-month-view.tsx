"use client";

import { cn } from "@/lib/utils";

import {
  eventsForDay,
  notesForDay,
  overflowLabel,
  visibleCellEvents,
} from "./calendar-range";
import { categoryDotClass } from "./category-chip";
import { CALENDAR_EMPTY, MONTH_CELL_EVENT_LIMIT } from "./constants";
import type { CalendarEvent, CalendarNote, MonthGrid } from "./types";

export function CalendarMonthView({
  grid,
  events,
  notes,
  canManageNotes,
  selectedDate,
  onSelectDay,
  onSelectEvent,
}: {
  grid: MonthGrid;
  events: CalendarEvent[];
  notes: CalendarNote[];
  canManageNotes: boolean;
  selectedDate: string | null;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (iso: string, eventId: string) => void;
}) {
  const monthHasEvents = events.some(
    (event) => event.endDate >= grid.rangeStart && event.startDate <= grid.rangeEnd,
  );

  return (
    <div className="space-y-3">
      {!monthHasEvents ? (
        <p className="ns-muted text-sm">{CALENDAR_EMPTY.month}</p>
      ) : null}

      <div className="border-border overflow-hidden rounded-xl border">
        <div
          className="bg-surface-muted text-muted-foreground grid grid-cols-7 border-b text-center text-[11px] font-medium tracking-wide uppercase"
          role="row"
        >
          {grid.weekdayLabels.map((label) => (
            <div key={label} className="px-1 py-2" role="columnheader">
              {label}
            </div>
          ))}
        </div>

        <div role="grid" aria-label={`${grid.label} calendar`}>
          {grid.weeks.map((week) => (
            <div
              key={week[0]?.iso}
              className="grid grid-cols-7 border-b last:border-b-0"
              role="row"
            >
              {week.map((cell) => {
                const dayEvents = eventsForDay(events, cell.iso);
                const dayNotes = canManageNotes ? notesForDay(notes, cell.iso) : [];
                const { shown, hidden } = visibleCellEvents(
                  dayEvents,
                  MONTH_CELL_EVENT_LIMIT,
                );
                return (
                  <div
                    key={cell.iso}
                    role="gridcell"
                    aria-selected={selectedDate === cell.iso}
                    className={cn(
                      "border-border min-h-[6.5rem] border-r p-1.5 last:border-r-0 sm:min-h-[7.25rem] sm:p-2",
                      !cell.inMonth && "bg-surface-muted/60",
                      selectedDate === cell.iso && "bg-muted/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDay(cell.iso)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-0.5 text-left",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      )}
                      aria-label={`${cell.iso}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                    >
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                          cell.isToday
                            ? "bg-heading text-primary-foreground"
                            : cell.inMonth
                              ? "text-heading"
                              : "text-muted-foreground",
                        )}
                      >
                        {Number(cell.iso.slice(8, 10))}
                      </span>
                      {dayNotes.length > 0 ? (
                        <span className="sr-only">
                          {dayNotes.length} leadership{" "}
                          {dayNotes.length === 1 ? "note" : "notes"}
                        </span>
                      ) : null}
                      {dayNotes.length > 0 ? (
                        <span
                          className="bg-heading/40 size-1.5 rounded-full"
                          aria-hidden
                          title="Leadership note"
                        />
                      ) : null}
                    </button>

                    <ul className="mt-1 space-y-0.5">
                      {shown.map((event) => (
                        <li key={event.id}>
                          <button
                            type="button"
                            onClick={() => onSelectEvent(cell.iso, event.id)}
                            className={cn(
                              "hover:bg-row-hover flex w-full items-center gap-1 rounded px-0.5 py-0.5 text-left text-[11px] leading-tight",
                              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                              cell.inMonth ? "text-heading" : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                categoryDotClass(event.category),
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{event.title}</span>
                          </button>
                        </li>
                      ))}
                      {hidden > 0 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => onSelectDay(cell.iso)}
                            className="text-muted-foreground hover:text-heading px-0.5 text-[11px] font-medium"
                          >
                            {overflowLabel(hidden)}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
