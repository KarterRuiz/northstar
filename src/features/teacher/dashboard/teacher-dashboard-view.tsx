import { AdminCalendarPanel } from "@/features/admin/dashboard/admin-calendar-panel";
import { loadHomeCalendarPreview } from "@/features/calendar/load-home-calendar";
import { CALENDAR_EMPTY } from "@/features/calendar/constants";

import { loadTeacherHomeData } from "./load-teacher-home";
import { TeacherCheckIn } from "./teacher-check-in";
import { TeacherQuickAccess } from "./teacher-quick-access";
import { TeacherRecords } from "./teacher-records";
import { TeacherTodaysClasses } from "./teacher-todays-classes";

export async function TeacherDashboardView() {
  const [data, calendar] = await Promise.all([
    loadTeacherHomeData(),
    loadHomeCalendarPreview("teacher"),
  ]);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <p className="font-medium">Could not load your workspace</p>
        <p className="mt-1 opacity-90">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {data.error ? (
        <p className="ns-muted" role="status">
          Some details could not be loaded right now.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <div className="lg:col-span-3">
          <TeacherTodaysClasses classes={data.classes} />
        </div>
        <div className="lg:col-span-2">
          <AdminCalendarPanel
            role="teacher"
            todayIso={calendar.todayIso}
            events={calendar.events}
            error={calendar.error}
            emptyCopy={CALENDAR_EMPTY.homeTeacher}
          />
        </div>
      </div>

      <TeacherQuickAccess cards={data.quickAccess} />

      <TeacherCheckIn
        students={data.checkIn}
        positiveNoteCount={data.positiveNoteCount}
      />

      <TeacherRecords records={data.records} />
    </div>
  );
}
