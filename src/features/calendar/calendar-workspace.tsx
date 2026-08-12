"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { CalendarAgendaView } from "./calendar-agenda-view";
import { calendarHref, eventsForDay, notesForDay } from "./calendar-range";
import { CalendarDayDrawer } from "./calendar-day-drawer";
import { CalendarEventForm } from "./calendar-event-form";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarNoteForm } from "./calendar-note-form";
import {
  CALENDAR_PARTIAL_LOAD,
  CALENDAR_SUBTITLE,
  CALENDAR_SUBTITLE_TEACHER,
} from "./constants";
import type { CalendarWorkspaceData } from "./load-calendar-workspace";
import { shiftMonthKey } from "./school-timezone";
import type { CalendarEvent, CalendarNote, CalendarView } from "./types";

function subscribeNarrowViewport(onChange: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getNarrowViewport() {
  return window.matchMedia("(max-width: 767px)").matches;
}

type FormPanel =
  | { kind: "event"; date: string; event?: CalendarEvent }
  | { kind: "note"; date: string; note?: CalendarNote };

export function CalendarWorkspace({
  role,
  data,
}: {
  role: Role;
  data: CalendarWorkspaceData;
}) {
  const router = useRouter();
  const narrow = useSyncExternalStore(
    subscribeNarrowViewport,
    getNarrowViewport,
    () => false,
  );
  const [formPanel, setFormPanel] = useState<FormPanel | null>(null);

  const view: CalendarView = data.viewExplicit
    ? data.view
    : narrow
      ? "agenda"
      : "month";

  const dayDate = formPanel ? null : data.selectedDate;
  const dayEvents = dayDate ? eventsForDay(data.events, dayDate) : [];
  const dayNotes = dayDate ? notesForDay(data.notes, dayDate) : [];

  const todayHref = calendarHref(role, { view });
  const prevHref = calendarHref(role, {
    view,
    month: shiftMonthKey(data.monthKey, -1),
  });
  const nextHref = calendarHref(role, {
    view,
    month: shiftMonthKey(data.monthKey, 1),
  });

  const monthLabel = data.grid.label;
  const canManageEvents = data.canManageEvents;
  const subtitle =
    role === "teacher" ? CALENDAR_SUBTITLE_TEACHER : CALENDAR_SUBTITLE;

  function hrefFor(state: { date?: string; event?: string; view?: CalendarView } = {}) {
    return calendarHref(role, {
      view: state.view ?? (data.viewExplicit ? view : undefined),
      month: data.monthKey === data.todayIso.slice(0, 7) ? undefined : data.monthKey,
      date: state.date,
      event: state.event,
    });
  }

  function openAddEvent(date = data.todayIso) {
    setFormPanel({ kind: "event", date });
  }

  function openDay(date: string, eventId?: string) {
    setFormPanel(null);
    router.replace(hrefFor({ date, event: eventId }), { scroll: false });
  }

  function closePanel() {
    setFormPanel(null);
    if (data.selectedDate || data.selectedEventId) {
      router.replace(hrefFor(), { scroll: false });
    }
  }

  function afterChange() {
    router.refresh();
  }

  return (
    <div className="ns-page-shell-wide">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Calendar"
        description={subtitle}
        actions={
          canManageEvents ? (
            <Button type="button" size="sm" onClick={() => openAddEvent()}>
              <Plus className="size-3.5" />
              Add Event
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button asChild size="sm" variant="outline">
            <Link href={todayHref}>Today</Link>
          </Button>
          <div className="border-border flex items-center rounded-md border">
            <Link
              href={calendarHref(role, {
                view: "month",
                month:
                  data.monthKey === data.todayIso.slice(0, 7) ? undefined : data.monthKey,
              })}
              aria-current={view === "month" ? "page" : undefined}
              className={cn(
                "rounded-l-md px-3 py-1.5 text-sm font-medium",
                view === "month"
                  ? "bg-heading text-primary-foreground"
                  : "text-muted-foreground hover:bg-row-hover hover:text-heading",
              )}
            >
              Month
            </Link>
            <Link
              href={calendarHref(role, { view: "agenda" })}
              aria-current={view === "agenda" ? "page" : undefined}
              className={cn(
                "rounded-r-md px-3 py-1.5 text-sm font-medium",
                view === "agenda"
                  ? "bg-heading text-primary-foreground"
                  : "text-muted-foreground hover:bg-row-hover hover:text-heading",
              )}
            >
              Agenda
            </Link>
          </div>
        </div>

        {view === "month" ? (
          <div className="flex items-center gap-1.5">
            <Button asChild size="icon" variant="ghost" aria-label="Previous month">
              <Link href={prevHref}>
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <p className="text-heading min-w-[9.5rem] text-center text-sm font-semibold">
              {monthLabel}
            </p>
            <Button asChild size="icon" variant="ghost" aria-label="Next month">
              <Link href={nextHref}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="ns-meta">Next several weeks</p>
        )}
      </div>

      {data.error ? (
        <p className="ns-muted" role="status">
          {data.error === CALENDAR_PARTIAL_LOAD ? data.error : CALENDAR_PARTIAL_LOAD}
        </p>
      ) : null}

      {view === "month" ? (
        <CalendarMonthView
          grid={data.grid}
          events={data.events}
          notes={data.notes}
          canManageNotes={data.canManageNotes}
          selectedDate={dayDate}
          onSelectDay={(iso) => openDay(iso)}
          onSelectEvent={(iso, eventId) => openDay(iso, eventId)}
        />
      ) : (
        <CalendarAgendaView
          events={data.events}
          notes={data.notes}
          canManageNotes={data.canManageNotes}
          todayIso={data.todayIso}
          onSelectDay={(iso) => openDay(iso)}
          onSelectEvent={(iso, eventId) => openDay(iso, eventId)}
        />
      )}

      <CalendarDayDrawer
        open={Boolean(dayDate)}
        date={dayDate}
        events={dayEvents}
        notes={dayNotes}
        canManageEvents={canManageEvents}
        canManageNotes={data.canManageNotes}
        focusEventId={data.selectedEventId}
        todayIso={data.todayIso}
        onOpenChange={(open) => {
          if (!open) closePanel();
        }}
        onAddEvent={() => {
          if (canManageEvents && dayDate) {
            setFormPanel({ kind: "event", date: dayDate });
          }
        }}
        onEditEvent={(event) =>
          setFormPanel({ kind: "event", date: event.startDate, event })
        }
        onAddNote={() => {
          if (dayDate) setFormPanel({ kind: "note", date: dayDate });
        }}
        onEditNote={(note) => setFormPanel({ kind: "note", date: note.noteDate, note })}
        onChanged={afterChange}
      />

      <Sheet
        open={canManageEvents && formPanel?.kind === "event"}
        onOpenChange={(open) => {
          if (!open) setFormPanel(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {formPanel?.kind === "event" && formPanel.event ? "Edit event" : "Add Event"}
            </SheetTitle>
            <SheetDescription>
              School dates stay on the intended Shanghai day. This does not create a
              follow-up.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto pr-1">
            {formPanel?.kind === "event" ? (
              <CalendarEventForm
                event={formPanel.event}
                defaultDate={formPanel.date}
                onSuccess={() => {
                  const date = formPanel.date;
                  const eventId = formPanel.event?.id;
                  setFormPanel(null);
                  afterChange();
                  router.replace(hrefFor({ date, event: eventId }), { scroll: false });
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={formPanel?.kind === "note"}
        onOpenChange={(open) => {
          if (!open) setFormPanel(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {formPanel?.kind === "note" && formPanel.note ? "Edit note" : "Add note"}
            </SheetTitle>
            <SheetDescription>
              Private to leadership. Notes are not calendar events.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto pr-1">
            {formPanel?.kind === "note" ? (
              <CalendarNoteForm
                note={formPanel.note}
                defaultDate={formPanel.date}
                onSuccess={() => {
                  const date = formPanel.date;
                  setFormPanel(null);
                  afterChange();
                  router.replace(hrefFor({ date }), { scroll: false });
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
