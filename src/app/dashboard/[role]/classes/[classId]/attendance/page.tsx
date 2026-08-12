import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
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

export default async function TeacherClassAttendancePage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  const dateRaw = pickString((await searchParams).date) ?? null;

  return <ClassAttendanceTab classId={classId} attendanceDate={dateRaw} />;
}
