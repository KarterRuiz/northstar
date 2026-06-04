import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { AttendanceTab } from "@/features/students/profile/tabs/attendance-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentAttendancePage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <AttendanceTab studentId={studentId} role={roleParam} />;
}
