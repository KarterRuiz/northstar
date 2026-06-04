import { notFound, redirect } from "next/navigation";

import { AdminAttendancePageContent } from "@/features/attendance/admin/admin-attendance-page";
import { AttendanceWorkspacePageContent } from "@/features/attendance/attendance-workspace-page";
import { assertLeadershipDashboardRole } from "@/features/academic-review/assert-leadership-dashboard-role";
import { isRole } from "@/config/roles";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AttendancePage({ params, searchParams }: PageProps) {
  const { role } = await params;
  const sp = await searchParams;
  if (!isRole(role)) notFound();

  if (role === "admin") {
    await assertLeadershipDashboardRole(role);
    const dateRaw = pickString(sp.date);
    const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
    return (
      <AdminAttendancePageContent
        date={date}
        schoolYear={pickString(sp.schoolYear) ?? null}
        gradeId={pickString(sp.gradeId) ?? null}
        classId={pickString(sp.classId) ?? null}
        status={pickString(sp.status) ?? null}
        section={pickString(sp.section) ?? null}
        heatmapRows={pickString(sp.heatmapRows) ?? null}
      />
    );
  }

  if (role !== "teacher") redirect(`/dashboard/${role}`);

  const classIdRaw = pickString(sp.classId);
  const classId = classIdRaw && isUuid(classIdRaw) ? classIdRaw : null;
  const dateRaw = pickString(sp.date);
  const attendanceDate = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
  const tab = pickString(sp.tab) ?? null;
  const week = pickString(sp.week) ?? null;
  const monthRaw = pickString(sp.month);
  const month = monthRaw && /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : null;

  return (
    <AttendanceWorkspacePageContent
      classId={classId}
      attendanceDate={attendanceDate}
      tab={tab}
      week={week}
      month={month}
    />
  );
}
