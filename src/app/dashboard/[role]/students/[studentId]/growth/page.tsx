import Link from "next/link";
import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { GrowthTab } from "@/features/students/profile/tabs/growth-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentGrowthPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  const academicsHref = `/dashboard/${roleParam}/students/${studentId}/academics`;

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm">
        <Link
          href={academicsHref}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          ← Back to Academics
        </Link>
      </p>
      <GrowthTab />
    </div>
  );
}
