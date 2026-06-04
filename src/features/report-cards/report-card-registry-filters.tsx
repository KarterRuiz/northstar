import Link from "next/link";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import {
  REPORT_CARD_FILE_STATUSES,
  reportCardStatusLabel,
} from "@/lib/report-cards/status";

type ReportCardRegistryFiltersProps = {
  role: Role;
  defaults: {
    year: string;
    term: string;
    status: string;
    classId: string;
    q: string;
  };
  classOptions: { id: string; label: string }[];
  yearOptions: string[];
};

export function ReportCardRegistryFilters({
  role,
  defaults,
  classOptions,
  yearOptions,
}: ReportCardRegistryFiltersProps) {
  const action = `/dashboard/${role}/report-cards`;

  return (
    <form
      method="get"
      action={action}
      className="border-border bg-card/40 space-y-4 rounded-xl border p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="rc-year">School year</Label>
          <Input
            id="rc-year"
            name="year"
            list="rc-year-options"
            placeholder="e.g. 2025-2026"
            defaultValue={defaults.year}
            className="w-40"
          />
          <datalist id="rc-year-options">
            {yearOptions.map((y) => (
              <option key={y} value={y} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rc-term">Term</Label>
          <select
            id="rc-term"
            name="term"
            defaultValue={defaults.term}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-28 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">Any</option>
            {REPORT_CARD_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rc-status">Status</Label>
          <select
            id="rc-status"
            name="status"
            defaultValue={defaults.status}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-36 rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">Any</option>
            {REPORT_CARD_FILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {reportCardStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-2">
          <Label htmlFor="rc-class">Class</Label>
          <select
            id="rc-class"
            name="class"
            defaultValue={defaults.classId}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full max-w-xs rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <option value="">Any class</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1 space-y-2">
          <Label htmlFor="rc-q">Student</Label>
          <Input
            id="rc-q"
            name="q"
            placeholder="Name or student UUID"
            defaultValue={defaults.q}
            className="w-full max-w-sm"
          />
        </div>
        <div className="flex gap-2 pb-0.5">
          <Button type="submit" size="sm">
            Search
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={action}>Reset</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}
