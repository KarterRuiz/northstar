import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { TeacherClassContext } from "./load-teacher-class-context";

export function ClassWorkspaceHeader({ context }: { context: TeacherClassContext }) {
  return (
    <header className="space-y-3">
      <nav aria-label="Class workspace navigation">
        <Link
          href="/dashboard/teacher/classes"
          className="text-muted-foreground hover:text-heading inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none lg:min-h-0"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          My Classes
        </Link>
      </nav>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-tight">
            {context.title}
          </h1>
          {!context.isCurrentYear ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              Previous year
            </span>
          ) : null}
          {!context.isActive ? (
            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
              Inactive
            </span>
          ) : null}
        </div>
        <p className="ns-meta">{context.meta}</p>
      </div>
    </header>
  );
}
