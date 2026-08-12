import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Inbox,
  ListChecks,
  School,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";

import type { AdminQuickAccessCard } from "./load-admin-command-center";
import type { AdminQuickAccessId } from "./constants";

const ICONS: Record<AdminQuickAccessId, LucideIcon> = {
  students: Users,
  staff: GraduationCap,
  attendance: CalendarCheck,
  classes: School,
  "report-cards": FileText,
  "follow-up": ListChecks,
  "parent-requests": Inbox,
  "academic-review": ClipboardList,
};

/**
 * Compact workspace launch cards — one live summary each, direct navigation.
 */
export function AdminQuickAccess({
  cards,
}: {
  cards: AdminQuickAccessCard[];
}) {
  return (
    <section
      aria-labelledby="admin-quick-access-heading"
      className="space-y-2.5"
    >
      <WorkspaceSectionHeader
        id="admin-quick-access-heading"
        title="Quick Access"
      />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = ICONS[card.id];
          return (
            <Link
              key={card.id}
              href={card.path}
              className="group block rounded-xl outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Card
                variant="interactive"
                className="h-full min-h-[5.25rem] transition-colors duration-150 ease-out group-hover:border-heading group-hover:bg-heading group-hover:text-primary-foreground"
              >
                <CardHeader density="metric" className="pb-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="text-muted-foreground size-3.5 shrink-0 transition-colors group-hover:text-primary-foreground/80"
                      aria-hidden
                    />
                    <CardTitle className="text-[13px] transition-colors group-hover:text-primary-foreground">
                      {card.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent density="metric">
                  <p className="ns-meta line-clamp-2 transition-colors group-hover:text-primary-foreground/75">
                    {card.summary}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
