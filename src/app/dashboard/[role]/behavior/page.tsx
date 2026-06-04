import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BehaviorWorkspacePageContent } from "@/features/behavior/behavior-workspace-page";
import { isRole } from "@/config/roles";
import { isStudentId, isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export const metadata: Metadata = {
  title: "Support board",
  description: "Fast coaching moments and class-wide support timeline.",
};

export default async function BehaviorPage({ params, searchParams }: PageProps) {
  const { role } = await params;
  const sp = await searchParams;
  if (!isRole(role)) notFound();
  if (role !== "teacher") redirect(`/dashboard/${role}`);

  const classIdRaw = pickString(sp.classId);
  const classId = classIdRaw && isUuid(classIdRaw) ? classIdRaw : null;
  const studentRaw = pickString(sp.studentId);
  const studentId = studentRaw && isStudentId(studentRaw) ? studentRaw : null;

  return (
    <BehaviorWorkspacePageContent classId={classId} studentId={studentId} />
  );
}
