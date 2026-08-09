import Link from "next/link";

import type { Role } from "@/config/roles";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";

type StaffProfileNavProps = {
  role: Role;
  staffName: string;
};

export function StaffProfileNav({ role, staffName }: StaffProfileNavProps) {
  return (
    <nav aria-label="Staff profile breadcrumb" className="ns-meta">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href={staffDirectoryPath(role)}
            className="text-muted-foreground hover:text-foreground ns-transition underline-offset-2 hover:underline"
          >
            Teachers &amp; staff
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground/60">
          /
        </li>
        <li className="text-foreground truncate font-medium">{staffName}</li>
      </ol>
    </nav>
  );
}
