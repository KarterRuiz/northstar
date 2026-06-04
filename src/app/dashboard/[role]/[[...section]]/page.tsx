import { notFound } from "next/navigation";

import { SectionPlaceholder } from "@/components/workspace/section-placeholder";
import { isRole, roleLabels, type Role } from "@/config/roles";
import { AdminDashboardHome } from "@/features/admin/dashboard/admin-dashboard-home";
import { getAdminSectionShellProps } from "@/features/admin/sections/admin-section-shell";
import { TeacherDashboardHome } from "@/features/teacher/dashboard/teacher-dashboard-home";
import { humanizePathSegments } from "@/lib/breadcrumbs";

type PageProps = {
  params: Promise<{ role: string; section?: string[] }>;
};

export default async function DashboardRoleSectionPage({ params }: PageProps) {
  const { role, section } = await params;
  if (!isRole(role)) notFound();

  const hasSection = Boolean(section?.length);

  if (role === "teacher" && !hasSection) {
    return <TeacherDashboardHome />;
  }

  if (role === "teacher" && hasSection) {
    return (
      <SectionPlaceholder
        role={role}
        sectionLabel={humanizePathSegments(section, role)}
        minimal
        description={`You are in the ${roleLabels[role]} workspace. This section is not available yet.`}
      />
    );
  }

  const typedRole = role as Role;

  if (typedRole === "admin" && !hasSection) {
    return <AdminDashboardHome />;
  }

  const adminShell =
    typedRole === "admin" && hasSection
      ? getAdminSectionShellProps(section!)
      : null;

  if (typedRole === "admin") {
    return (
      <SectionPlaceholder
        role={typedRole}
        sectionLabel={humanizePathSegments(section, typedRole)}
        title={adminShell?.title}
        description={adminShell?.description}
        emptyState={adminShell?.emptyState}
        minimal={Boolean(adminShell)}
      />
    );
  }

  return (
    <SectionPlaceholder
      role={typedRole}
      sectionLabel={humanizePathSegments(section, typedRole)}
    />
  );
}
