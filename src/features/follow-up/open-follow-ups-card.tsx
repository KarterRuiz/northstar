import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/config/roles";

import { formatFollowUpDue, todayForFollowUp } from "./classify";
import { FollowUpFormSheet } from "./follow-up-form-sheet";
import type { FollowUpItem, FollowUpPrefill } from "./types";

export function OpenFollowUpsCard({
  role,
  items,
  prefill,
  addLabel,
}: {
  role: Role;
  items: FollowUpItem[];
  prefill?: FollowUpPrefill;
  addLabel?: string;
}) {
  if (items.length === 0) return null;

  const today = todayForFollowUp();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="ns-card-title">Open follow-ups</CardTitle>
        </div>
        <FollowUpFormSheet
          prefill={prefill}
          triggerLabel={addLabel ?? "Add Follow-Up"}
          triggerVariant="outline"
        />
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-heading truncate text-sm font-medium">{item.title}</p>
                <p className="ns-meta">{formatFollowUpDue(item.dueOn, today)}</p>
              </div>
              <Link
                href={`/dashboard/${role}/follow-up`}
                className="text-primary shrink-0 text-xs font-medium hover:underline"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
