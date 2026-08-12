import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { Role } from "@/config/roles";
import { calendarHref, formatHomeEventWhen } from "@/features/calendar/calendar-range";
import { CALENDAR_EMPTY } from "@/features/calendar/constants";
import type { HomeCalendarEvent } from "@/features/calendar/types";
import {
  formatSchoolHomeDate,
  formatSchoolMonthYear,
} from "@/features/calendar/school-timezone";

/**
 * Compact upcoming-events window on Admin Home.
 * Entire card opens the Calendar workspace. Individual events deep-link a day.
 * Leadership notes never appear here.
 */
export function AdminCalendarPanel({
  role,
  todayIso,
  events,
  error,
  emptyCopy = CALENDAR_EMPTY.home,
}: {
  role: Role;
  todayIso: string;
  events: HomeCalendarEvent[];
  error?: string | null;
  emptyCopy?: string;
}) {
  const workspaceHref = calendarHref(role);
  const monthLabel = formatSchoolMonthYear(todayIso);
  const dayLabel = formatSchoolHomeDate(todayIso);

  return (
    <section
      aria-labelledby="admin-calendar-heading"
      className="flex h-full flex-col space-y-2.5"
    >
      <WorkspaceSectionHeader id="admin-calendar-heading" title="Calendar" />

      <Card
        variant="interactive"
        className="group relative flex h-full min-h-[10rem] flex-1 flex-col overflow-hidden p-3.5 transition-colors duration-150 ease-out hover:border-heading hover:bg-heading hover:text-primary-foreground sm:p-4"
      >
        <Link
          href={workspaceHref}
          className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open Calendar"
        />

        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ns-meta transition-colors group-hover:text-primary-foreground/75">
              {monthLabel}
            </p>
            <p className="text-heading mt-0.5 text-sm font-medium transition-colors group-hover:text-primary-foreground">
              {dayLabel}
            </p>
          </div>
          <CalendarDays
            className="text-muted-foreground size-4 shrink-0 transition-colors group-hover:text-primary-foreground/80"
            aria-hidden
          />
        </div>

        <div className="relative z-10 mt-3 flex flex-1 flex-col">
          {error ? (
            <p
              className="ns-muted text-sm transition-colors group-hover:text-primary-foreground/75"
              role="status"
            >
              {error}
            </p>
          ) : events.length === 0 ? (
            <div className="border-border flex flex-1 flex-col justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-colors group-hover:border-primary-foreground/25">
              <p className="text-heading text-sm font-medium transition-colors group-hover:text-primary-foreground">
                Upcoming
              </p>
              <p className="ns-muted mt-1 text-sm leading-snug transition-colors group-hover:text-primary-foreground/75">
                {emptyCopy}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={calendarHref(role, {
                      date: event.startDate < todayIso ? todayIso : event.startDate,
                      event: event.id,
                    })}
                    className="relative z-10 block rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover:hover:bg-primary-foreground/10"
                  >
                    <p className="text-heading truncate text-sm font-medium transition-colors group-hover:text-primary-foreground">
                      {event.title}
                    </p>
                    <p className="ns-meta transition-colors group-hover:text-primary-foreground/75">
                      {formatHomeEventWhen(event, todayIso)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
