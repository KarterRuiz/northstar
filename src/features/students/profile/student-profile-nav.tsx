import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import type { Role } from "@/config/roles";
import { roleLabels } from "@/config/roles";

type StudentProfileNavProps = {
  role: Role;
  studentId: string;
  studentName?: string;
};

export function StudentProfileNav({
  role,
  studentId,
  studentName,
}: StudentProfileNavProps) {
  const studentsHref = `/dashboard/${role}/students`;
  const profileHref = `/dashboard/${role}/students/${studentId}/overview`;

  return (
    <nav
      aria-label="Student profile navigation"
      className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs sm:text-sm"
    >
      <Link
        href={studentsHref}
        className="hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Students
      </Link>
      <ChevronRight className="size-3.5 opacity-50" aria-hidden />
      {studentName ? (
        <>
          <Link
            href={profileHref}
            className="hover:text-foreground max-w-[12rem] truncate font-medium transition-colors sm:max-w-xs"
          >
            {studentName}
          </Link>
          <span className="text-muted-foreground hidden sm:inline">
            · {roleLabels[role]}
          </span>
        </>
      ) : (
        <span className="text-foreground font-medium">Student profile</span>
      )}
    </nav>
  );
}
