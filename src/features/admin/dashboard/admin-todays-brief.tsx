import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import { cn } from "@/lib/utils";

import type { AdminTodaysBrief } from "./load-admin-command-center";

/**
 * Compact leadership briefing — orients, does not lead with problems.
 */
export function AdminTodaysBrief({
  brief,
  error,
}: {
  brief: AdminTodaysBrief;
  error?: string | null;
}) {
  return (
    <section
      aria-labelledby="admin-todays-brief-heading"
      className="flex h-full flex-col space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-todays-brief-heading"
        title="Today's Brief"
      />

      <Card className="flex flex-1 flex-col p-3.5 sm:p-4">
        {error ? (
          <p className="ns-muted" role="status">
            Some briefing details could not be loaded right now.
          </p>
        ) : null}

        <p className="text-heading text-sm font-medium leading-snug sm:text-[15px]">
          {brief.headline}
        </p>

        {brief.lines.length === 0 && !error ? (
          <div
            role="status"
            className="text-muted-foreground mt-3 flex items-center gap-2"
          >
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <p className="ns-body">Nothing urgent on the desk.</p>
          </div>
        ) : null}

        {brief.lines.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {brief.lines.map((line) => {
              const row = (
                <>
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      line.tone === "steady" && "bg-success",
                      line.tone === "info" && "bg-muted-foreground/40",
                      line.tone === "follow_up" && "bg-primary/70",
                    )}
                    aria-hidden
                  />
                  <span className="ns-body min-w-0 flex-1 leading-snug">
                    {line.text}
                  </span>
                  {line.href ? (
                    <ChevronRight
                      className="text-muted-foreground size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  ) : null}
                </>
              );

              return (
                <li key={line.id}>
                  {line.href ? (
                    <Link
                      href={line.href}
                      className="hover:bg-row-hover group -mx-1.5 flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="-mx-1.5 flex items-start gap-2.5 px-1.5 py-1.5">
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
