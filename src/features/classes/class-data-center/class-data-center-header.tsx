import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import type { Role } from "@/config/roles";
import { studentCountLabel } from "./class-data-center-copy";
import type { ClassDataCenterContext } from "./load-class-data-center-context";

export function ClassDataCenterHeader({
  context,
  actions,
}: {
  context: ClassDataCenterContext;
  actions?: ReactNode;
}) {
  const role = context.role as Role;
  const classesHref = `/dashboard/${role}/classes`;

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <nav aria-label="Class data center navigation">
          <Link
            href={classesHref}
            className="text-muted-foreground hover:text-heading inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none lg:min-h-0"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Classes
          </Link>
        </nav>
        {actions}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-tight">
            {context.title}
          </h1>
          {!context.isActive ? (
            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
              Archived
            </span>
          ) : null}
          {!context.isCurrentYear ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              Previous year
            </span>
          ) : null}
        </div>
        <p className="ns-meta">{context.meta}</p>
        <p className="text-muted-foreground text-sm">{studentCountLabel(context.studentCount)}</p>

        <div className="text-sm leading-relaxed">
          <p>
            <span className="text-muted-foreground">Homeroom Teacher: </span>
            {context.homeroom ? (
              <Link
                href={context.homeroom.href}
                className="text-primary font-medium underline-offset-4 hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              >
                {context.homeroom.displayName}
              </Link>
            ) : (
              <span className="text-heading">None</span>
            )}
          </p>
          <p className="mt-0.5">
            <span className="text-muted-foreground">Additional Teachers: </span>
            {context.additionalTeachers.length === 0 ? (
              <span className="text-heading">None</span>
            ) : (
              context.additionalTeachers.map((t, i) => (
                <span key={t.staffMemberId}>
                  {i > 0 ? ", " : null}
                  <Link
                    href={t.href}
                    className="text-primary font-medium underline-offset-4 hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t.displayName}
                  </Link>
                </span>
              ))
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
