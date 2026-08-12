import { Suspense } from "react";

import { isLeadershipAuditRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { AdminCalendarPanel } from "@/features/admin/dashboard/admin-calendar-panel";
import { getAdminDailyNote } from "@/features/admin/dashboard/admin-daily-note";
import { getAdminWordOfTheDay } from "@/features/admin/dashboard/admin-word-of-the-day";
import { AdminDashboardSkeleton } from "@/features/admin/dashboard/admin-dashboard-skeleton";
import { AdminQuickAccess } from "@/features/admin/dashboard/admin-quick-access";
import { AdminRecentActivity } from "@/features/admin/dashboard/admin-recent-activity";
import { AdminSchoolPulse } from "@/features/admin/dashboard/admin-school-pulse";
import { AdminTodaysBrief } from "@/features/admin/dashboard/admin-todays-brief";
import {
  loadAdminCommandCenter,
  loadAdminOverviewGreetingName,
} from "@/features/admin/dashboard/load-admin-command-center";
import { loadHomeCalendarPreview } from "@/features/calendar/load-home-calendar";
import { getProfileRole, getUser } from "@/lib/auth/session";

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
 * Admin Home — calm leadership command center.
 * Orients, briefs, and launches into workspaces; management stays on dedicated pages.
 */
export async function AdminDashboardHome() {
  const user = await getUser();
  const profileRole = user ? await getProfileRole(user.id) : null;
  const role: Role =
    profileRole && isLeadershipAuditRole(profileRole) ? profileRole : "admin";
  const greetingName = user
    ? await loadAdminOverviewGreetingName(user.id)
    : null;

  const now = new Date();
  const greeting = greetingName
    ? `${timeOfDayGreeting()}, ${greetingName}`
    : timeOfDayGreeting();
  const dailyNote = getAdminDailyNote(now);
  const wordOfTheDay = getAdminWordOfTheDay(now);

  return (
    <div className="ns-page-shell">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Home"
        description="Your school day at a glance."
      />

      <div className="space-y-5 sm:space-y-6">
        <header className="space-y-2.5">
          <div className="space-y-1">
            <p className="text-heading text-lg font-semibold tracking-tight sm:text-xl">
              {greeting}
            </p>
            <p className="ns-meta">{formatLongDate(now)}</p>
            <p className="ns-muted max-w-xl text-sm leading-snug">{dailyNote}</p>
          </div>
          <p className="max-w-xl">
            <span className="ns-eyebrow">Word of the day</span>
            <span className="mt-1 block text-sm leading-snug">
              <strong className="text-heading font-semibold">
                {wordOfTheDay.word}
              </strong>
              <span className="text-muted-foreground">
                {" — "}
                {wordOfTheDay.definition}
              </span>
            </span>
          </p>
        </header>

        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminHomeBody role={role} />
        </Suspense>

        <Suspense fallback={null}>
          <AdminRecentActivity />
        </Suspense>
      </div>
    </div>
  );
}

async function AdminHomeBody({
  role,
}: {
  role: Role;
}) {
  const [data, calendar] = await Promise.all([
    loadAdminCommandCenter(role),
    loadHomeCalendarPreview(role),
  ]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <div className="lg:col-span-3">
          <AdminTodaysBrief brief={data.brief} error={data.error} />
        </div>
        <div className="lg:col-span-2">
          <AdminCalendarPanel
            role={role}
            todayIso={calendar.todayIso}
            events={calendar.events}
            error={calendar.error}
          />
        </div>
      </div>

      <AdminQuickAccess cards={data.quickAccess} />

      <AdminSchoolPulse indicators={data.pulse} error={data.error} />
    </div>
  );
}
