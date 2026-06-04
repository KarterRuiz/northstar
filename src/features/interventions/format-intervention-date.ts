function parseIso(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Absolute calendar date for follow-up, created, etc. */
export function formatInterventionDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseIso(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Relative label for last-updated display (Today, Yesterday, or absolute date). */
export function formatInterventionUpdatedAt(iso: string): string {
  const d = parseIso(iso);
  if (!d) return "—";

  const today = startOfLocalDay(new Date());
  const then = startOfLocalDay(d);
  const diffDays = Math.round((today.getTime() - then.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return formatInterventionDate(iso);
}
