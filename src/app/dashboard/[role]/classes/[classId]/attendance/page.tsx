import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { ClassDataCenterAttendanceTab } from "@/features/classes/class-data-center/class-attendance-tab";
import { ClassAttendanceTab } from "@/features/teacher/class-workspace/class-attendance-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class attendance",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ClassAttendancePage({ params, searchParams }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  const dateRaw = pickString((await searchParams).date) ?? null;

  if (role === "teacher") {
    return <ClassAttendanceTab classId={classId} attendanceDate={dateRaw} />;
  }
  if (!canManageSchoolStructure(role)) notFound();
  return <ClassDataCenterAttendanceTab classId={classId} attendanceDate={dateRaw} />;
}
