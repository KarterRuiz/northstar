import { notFound, redirect } from "next/navigation";

import { isRole } from "@/config/roles";

type PageProps = {
  params: Promise<{ role: string }>;
};

/** Alias URL for the teacher support board (canonical route remains `/behavior`). */
export default async function StudentSupportRedirect({ params }: PageProps) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  if (role !== "teacher") redirect(`/dashboard/${role}`);
  redirect(`/dashboard/teacher/behavior`);
}
