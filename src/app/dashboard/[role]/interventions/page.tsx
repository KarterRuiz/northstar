import { notFound, redirect } from "next/navigation";

import { isRole } from "@/config/roles";
import { InterventionsWorkspacePageContent } from "@/features/interventions/interventions-workspace-page";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function InterventionsPage({ params, searchParams }: PageProps) {
  const { role } = await params;
  const sp = await searchParams;
  if (!isRole(role)) notFound();

  if (role !== "teacher") {
    redirect(`/dashboard/${role}`);
  }

  const classIdRaw = pickString(sp.classId);
  const classId = classIdRaw && isUuid(classIdRaw) ? classIdRaw : null;

  return <InterventionsWorkspacePageContent classId={classId} />;
}
