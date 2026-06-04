import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { TransitionNotesTab } from "@/features/students/profile/tabs/transition-notes-tab";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentTransitionNotesPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  return <TransitionNotesTab studentId={studentId} viewerRole={role} />;
}
