import { redirect } from "next/navigation";

import { isRole } from "@/config/roles";

type PageProps = {
  params: Promise<{ role: string }>;
};

/** Legacy hub — academic records are entered from class rosters and student profiles. */
export default async function AcademicRecordsIndexRedirect({ params }: PageProps) {
  const { role } = await params;
  if (!isRole(role)) {
    redirect("/dashboard");
  }
  redirect(`/dashboard/${role}/students`);
}
