import { redirect } from "next/navigation";

import { isRole } from "@/config/roles";

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

/** Legacy route — report card command center lives on `/report-cards`. */
export default async function ReportCardWorkspaceRedirect({
  params,
  searchParams,
}: PageProps) {
  const { role } = await params;
  const sp = await searchParams;
  if (!isRole(role)) {
    redirect("/dashboard");
  }

  const query = new URLSearchParams();
  const classId = pickString(sp.classId);
  const term = pickString(sp.term);
  if (classId) query.set("classId", classId);
  if (term) query.set("term", term);

  const qs = query.toString();
  redirect(
    qs
      ? `/dashboard/${role}/report-cards?${qs}`
      : `/dashboard/${role}/report-cards`,
  );
}
