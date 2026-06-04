import Link from "next/link";
import { notFound } from "next/navigation";

import {
  canManageParentRecordRequests,
  canManageStudents,
  canTeacherEditStudentBasicInfo,
  isRole,
  isStudentProfileViewerRole,
  roleLabels,
  type Role,
} from "@/config/roles";
import { Button } from "@/components/ui/button";
import { StudentProfileHeader } from "@/features/students/profile/student-profile-header";
import { StudentProfileIndicators } from "@/features/students/profile/student-profile-indicators";
import { StudentProfileNav } from "@/features/students/profile/student-profile-nav";
import { StudentProfileTabs } from "@/features/students/profile/student-profile-tabs";
import { loadStudentProfileResult } from "@/features/students/profile/supabase-profile-data";
import { recordAuditEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth/session";
import { isStudentId } from "@/lib/students/uuid";

export default async function StudentProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string; studentId: string }>;
}) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  const role = roleParam as Role;

  if (!isStudentProfileViewerRole(role)) {
    void children;
    return (
      <div className="mx-auto max-w-2xl space-y-2 p-4 sm:p-6 lg:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Restricted</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Student profiles are available to{" "}
          <span className="text-foreground font-medium">admins</span>,{" "}
          <span className="text-foreground font-medium">teachers</span>,{" "}
          <span className="text-foreground font-medium">registrars</span>, and{" "}
          <span className="text-foreground font-medium">school leadership</span>
          . Open this URL while signed in with an authorized role.
        </p>
      </div>
    );
  }

  const profileLoad = await loadStudentProfileResult(studentId);
  if (profileLoad.kind === "not_found") {
    notFound();
  }

  if (profileLoad.kind === "ok") {
    const user = await getUser();
    await recordAuditEvent({
      action: "student_profile_viewed",
      metadata: { studentId },
      actorUserId: user?.id,
    });
  }

  const hubHint =
    "Report card PDFs live in the private Supabase bucket report-cards; " +
    "downloads use short-lived signed URLs when your role has storage access.";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {profileLoad.kind === "error" ? (
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">Could not load this student</p>
          <p className="mt-1 opacity-90">{profileLoad.message}</p>
        </div>
      ) : null}

      {profileLoad.kind === "ok" ? (
        <section className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
          <div className="space-y-5 p-4 sm:p-6 lg:p-8">
            <StudentProfileNav
              role={role}
              studentId={studentId}
              studentName={profileLoad.profile.fullName}
            />
            <StudentProfileHeader
              profile={profileLoad.profile}
              hubHint={hubHint}
              routeStudentId={studentId}
              viewerRoleLabel={roleLabels[role]}
              actions={
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                  {canManageParentRecordRequests(role) ? (
                    <Button variant="secondary" asChild className="w-full sm:w-auto">
                      <Link
                        href={`/dashboard/${role}/students/${studentId}/record-packet`}
                      >
                        Record packet
                      </Link>
                    </Button>
                  ) : null}
                  {canManageStudents(role) || canTeacherEditStudentBasicInfo(role) ? (
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                      <Link href={`/dashboard/${role}/students/${studentId}/edit`}>
                        Edit student
                      </Link>
                    </Button>
                  ) : null}
                </div>
              }
            />
            <StudentProfileIndicators studentId={studentId} role={role} />
          </div>
          <div className="border-border/60 space-y-6 border-t px-6 pt-5 pb-8 sm:px-8">
            <StudentProfileTabs role={role} studentId={studentId} />
            <div>{children}</div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                Student record
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Student profile
              </h1>
              <p className="text-muted-foreground font-mono text-xs break-all">{studentId}</p>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Signed in as {roleLabels[role]}. {hubHint}
              </p>
            </div>
          </div>
          <StudentProfileTabs role={role} studentId={studentId} />
          <div>{children}</div>
        </>
      )}
    </div>
  );
}
