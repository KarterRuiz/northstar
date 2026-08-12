"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createSchoolEventAction,
  updateSchoolEventAction,
  type CalendarActionState,
} from "./calendar-actions";
import { EVENT_AUDIENCE_LABELS, EVENT_CATEGORY_LABELS } from "./constants";
import {
  EVENT_AUDIENCES,
  EVENT_CATEGORIES,
  type CalendarEvent,
} from "./types";

const selectClass =
  "border-input bg-card focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none";

export function CalendarEventForm({
  event,
  defaultDate,
  onSuccess,
}: {
  event?: CalendarEvent;
  defaultDate?: string;
  onSuccess?: () => void;
}) {
  const action = event ? updateSchoolEventAction : createSchoolEventAction;
  const [state, formAction, pending] = useActionState<
    CalendarActionState | undefined,
    FormData
  >(action, undefined);
  const handled = useRef(false);
  const titleId = useId();

  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [startDate, setStartDate] = useState(event?.startDate ?? defaultDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? defaultDate ?? "");

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />

      <FormField id={titleId} label="Title" required>
        <Input
          id={titleId}
          name="title"
          required
          maxLength={160}
          defaultValue={event?.title ?? ""}
          placeholder="Orientation Week"
          aria-invalid={state && !state.ok ? true : undefined}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="event-start-date" label="Date" required>
          <Input
            id="event-start-date"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              const next = e.target.value;
              setStartDate(next);
              if (!endDate || endDate < next) setEndDate(next);
            }}
          />
        </FormField>
        <FormField id="event-end-date" label="End date" optional>
          <Input
            id="event-end-date"
            name="endDate"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="border-input size-4 rounded"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        <span className="text-heading">All day</span>
      </label>

      {!allDay ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField id="event-start-time" label="Start time" required>
            <Input
              id="event-start-time"
              name="startTime"
              type="time"
              required
              defaultValue={event?.startTime ?? "09:00"}
            />
          </FormField>
          <FormField id="event-end-time" label="End time" optional>
            <Input
              id="event-end-time"
              name="endTime"
              type="time"
              defaultValue={event?.endTime ?? "10:00"}
            />
          </FormField>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="event-category" label="Category">
          <select
            id="event-category"
            name="category"
            className={selectClass}
            defaultValue={event?.category ?? "school"}
          >
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {EVENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="event-audience"
          label="Audience"
          description="Leadership-only events stay off staff calendars."
        >
          <select
            id="event-audience"
            name="audience"
            className={selectClass}
            defaultValue={event?.audience ?? "all_staff"}
          >
            {EVENT_AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {EVENT_AUDIENCE_LABELS[audience]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id="event-location" label="Location" optional>
        <Input
          id="event-location"
          name="location"
          maxLength={160}
          defaultValue={event?.location ?? ""}
          placeholder="Gymnasium"
        />
      </FormField>

      <FormField id="event-description" label="Notes" optional>
        <Textarea
          id="event-description"
          name="description"
          maxLength={2000}
          defaultValue={event?.description ?? ""}
          className="min-h-[88px]"
        />
      </FormField>

      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : event ? "Save event" : "Add event"}
        </Button>
      </div>
    </form>
  );
}
