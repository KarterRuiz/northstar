"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  archiveSchoolEventAction,
  deleteCalendarNoteAction,
  type CalendarActionState,
} from "./calendar-actions";
import { eventRangeLabel, formatEventWhen } from "./calendar-range";
import { CategoryChip } from "./category-chip";
import { CALENDAR_EMPTY, EVENT_AUDIENCE_LABELS } from "./constants";
import { formatSchoolDayHeading } from "./school-timezone";
import type { CalendarEvent, CalendarNote } from "./types";

export function CalendarDayDrawer({
  open,
  date,
  events,
  notes,
  canManageEvents = true,
  canManageNotes,
  focusEventId,
  todayIso,
  onOpenChange,
  onAddEvent,
  onEditEvent,
  onAddNote,
  onEditNote,
  onChanged,
}: {
  open: boolean;
  date: string | null;
  events: CalendarEvent[];
  notes: CalendarNote[];
  canManageEvents?: boolean;
  canManageNotes: boolean;
  focusEventId?: string | null;
  todayIso: string;
  onOpenChange: (open: boolean) => void;
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onAddNote: () => void;
  onEditNote: (note: CalendarNote) => void;
  onChanged: () => void;
}) {
  const [archiveEvent, setArchiveEvent] = useState<CalendarEvent | null>(null);
  const [deleteNote, setDeleteNote] = useState<CalendarNote | null>(null);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{date ? formatSchoolDayHeading(date) : "Day"}</SheetTitle>
            <SheetDescription>
              {canManageNotes
                ? "Events and private leadership notes for this date."
                : "School and staff events for this date."}
            </SheetDescription>
          </SheetHeader>

          {canManageEvents || canManageNotes ? (
            <div className="flex flex-wrap gap-2">
              {canManageEvents ? (
                <Button type="button" size="sm" onClick={onAddEvent}>
                  Add Event
                </Button>
              ) : null}
              {canManageNotes ? (
                <Button type="button" size="sm" variant="outline" onClick={onAddNote}>
                  Add Note
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-5 overflow-y-auto pr-1">
            <section aria-labelledby="day-events-heading" className="space-y-2">
              <h3 id="day-events-heading" className="ns-section-title text-sm">
                Events
              </h3>
              {events.length === 0 ? (
                <p className="ns-muted text-sm">{CALENDAR_EMPTY.dayEvents}</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className={
                        focusEventId === event.id
                          ? "border-heading/30 rounded-lg border p-3"
                          : "border-border rounded-lg border p-3"
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-heading text-sm font-medium">{event.title}</p>
                          <p className="ns-meta mt-0.5">
                            {formatEventWhen(event, todayIso)}
                            {event.allDay && event.startDate !== event.endDate
                              ? ` · ${eventRangeLabel(event)}`
                              : event.allDay
                                ? " · All day"
                                : null}
                          </p>
                          {event.location ? (
                            <p className="ns-muted mt-0.5 text-xs">{event.location}</p>
                          ) : null}
                        </div>
                        <CategoryChip category={event.category} />
                      </div>
                      <p className="ns-meta mt-1">
                        {EVENT_AUDIENCE_LABELS[event.audience]}
                      </p>
                      {event.description ? (
                        <p className="ns-muted mt-2 text-sm leading-snug">{event.description}</p>
                      ) : null}
                      {canManageEvents ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onEditEvent(event)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setArchiveEvent(event)}
                          >
                            Archive
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canManageNotes ? (
              <section aria-labelledby="day-notes-heading" className="space-y-2">
                <h3 id="day-notes-heading" className="ns-section-title text-sm">
                  Leadership notes
                </h3>
                {notes.length === 0 ? (
                  <p className="ns-muted text-sm">{CALENDAR_EMPTY.dayNotes}</p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map((item) => (
                      <li key={item.id} className="border-border rounded-lg border p-3">
                        <p className="text-heading text-sm leading-snug">{item.note}</p>
                        {item.related.staffLabel ||
                        item.related.studentLabel ||
                        item.related.classLabel ? (
                          <p className="ns-meta mt-1">
                            {item.related.staffLabel ??
                              item.related.studentLabel ??
                              item.related.classLabel}
                          </p>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onEditNote(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteNote(item)}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmArchiveDialog
        event={archiveEvent}
        onClose={() => setArchiveEvent(null)}
        onChanged={onChanged}
      />
      <ConfirmDeleteNoteDialog
        note={deleteNote}
        onClose={() => setDeleteNote(null)}
        onChanged={onChanged}
      />
    </>
  );
}

function ConfirmArchiveDialog({
  event,
  onClose,
  onChanged,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CalendarActionState | undefined,
    FormData
  >(archiveSchoolEventAction, undefined);
  const handled = useRef(false);

  useEffect(() => {
    handled.current = false;
  }, [event?.id]);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onChanged();
      onClose();
    }
  }, [state, onChanged, onClose]);

  return (
    <Dialog open={Boolean(event)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this event?</DialogTitle>
          <DialogDescription>
            {event
              ? `“${event.title}” will no longer appear on the calendar.`
              : "This event will no longer appear on the calendar."}
          </DialogDescription>
        </DialogHeader>
        {state && !state.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="eventId" value={event?.id ?? ""} />
            <Button type="submit" variant="destructive" disabled={pending || !event}>
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteNoteDialog({
  note,
  onClose,
  onChanged,
}: {
  note: CalendarNote | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CalendarActionState | undefined,
    FormData
  >(deleteCalendarNoteAction, undefined);
  const handled = useRef(false);

  useEffect(() => {
    handled.current = false;
  }, [note?.id]);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onChanged();
      onClose();
    }
  }, [state, onChanged, onClose]);

  return (
    <Dialog open={Boolean(note)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this note?</DialogTitle>
          <DialogDescription>
            Leadership notes are removed permanently. This does not create a calendar event
            or follow-up.
          </DialogDescription>
        </DialogHeader>
        {state && !state.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="noteId" value={note?.id ?? ""} />
            <input type="hidden" name="noteDate" value={note?.noteDate ?? ""} />
            <Button type="submit" variant="destructive" disabled={pending || !note}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
