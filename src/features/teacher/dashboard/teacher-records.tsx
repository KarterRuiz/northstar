import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import type { TeacherRecordsSummary } from "./teacher-home-summaries";

export function TeacherRecords({ records }: { records: TeacherRecordsSummary }) {
  const showTransition = records.transition.relevant;
  const showQuiet = !records.due && !showTransition && !records.reportCards.started;

  return (
    <section aria-labelledby="teacher-records-heading" className="space-y-2.5">
      <WorkspaceSectionHeader id="teacher-records-heading" title="Records" />

      <Card className="p-3.5 sm:p-4">
        {showQuiet ? (
          <div role="status" className="text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
            <p className="ns-body">{records.emptyLabel}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {showTransition ? (
              <RecordsRow
                title="Transition Notes"
                summary={records.transition.label}
                href="/dashboard/teacher/transition-notes"
              />
            ) : null}
            <RecordsRow
              title="Report Cards"
              summary={records.reportCards.label}
              href="/dashboard/teacher/report-cards"
            />
          </ul>
        )}
      </Card>
    </section>
  );
}

function RecordsRow({
  title,
  summary,
  href,
}: {
  title: string;
  summary: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-row-hover group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 ease-out focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="text-heading block text-sm font-medium">{title}</span>
          <span className="ns-meta">{summary}</span>
        </span>
        <span className="ns-meta inline-flex items-center gap-0.5 transition-colors group-hover:text-heading">
          Open
          <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
