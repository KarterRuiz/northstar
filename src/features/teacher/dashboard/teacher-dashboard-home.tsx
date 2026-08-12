import { Suspense } from "react";

import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { siteConfig } from "@/config/site";
import { getUser } from "@/lib/auth/session";

import { getTeacherDailyNote } from "./teacher-daily-note";
import { TeacherDashboardSkeleton } from "./teacher-dashboard-skeleton";
import { TeacherDashboardView } from "./teacher-dashboard-view";
import { loadTeacherHomeGreetingName } from "./load-teacher-home";

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Teacher Home — classroom day planner.
 * Orients and launches into class work; full rosters and queues stay on dedicated pages.
 */
export async function TeacherDashboardHome() {
  const user = await getUser();
  const greetingName = user ? await loadTeacherHomeGreetingName(user.id) : null;
  const now = new Date();
  const greeting = greetingName
    ? `${timeOfDayGreeting()}, ${greetingName}`
    : timeOfDayGreeting();

  return (
    <div className="ns-page-shell">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Home"
        description="Your classroom day at a glance."
      />

      <div className="space-y-5 sm:space-y-6">
        <header className="space-y-1">
          <p className="text-heading text-lg font-semibold tracking-tight sm:text-xl">
            {greeting}
          </p>
          <p className="ns-meta">{formatLongDate(now)}</p>
          <p className="ns-muted max-w-xl text-sm leading-snug">
            {getTeacherDailyNote(now)}
          </p>
        </header>

        <Suspense fallback={<TeacherDashboardSkeleton />}>
          <TeacherDashboardView />
        </Suspense>
      </div>
    </div>
  );
}
