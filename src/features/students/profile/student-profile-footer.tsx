import Link from "next/link";

import { isLeadershipAuditRole, type Role } from "@/config/roles";

type StudentProfileFooterProps = {
  role: Role;
  studentId: string;
};

/**
 * Secondary navigation preserved outside the primary tab strip so deep links stay obvious.
 */
export function StudentProfileFooter({ role, studentId }: StudentProfileFooterProps) {
  if (!isLeadershipAuditRole(role)) return null;

  const base = `/dashboard/${role}/students/${studentId}`;

  return (
    <footer className="border-border/60 text-muted-foreground mt-6 border-t pt-4 text-xs">
      <Link
        href={`${base}/audit-history`}
        className="text-foreground font-medium underline-offset-4 hover:underline"
      >
        Audit history
      </Link>
      <span className="text-muted-foreground mx-2" aria-hidden>
        ·
      </span>
      <span>
        Development goals remain on the{" "}
        <Link
          href={`${base}/growth`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Growth
        </Link>{" "}
        route (linked from Academics).
      </span>
    </footer>
  );
}
