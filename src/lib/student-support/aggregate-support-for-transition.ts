/**
 * Foundation helpers for transition notes / handoffs — aggregate only; does not write notes.
 */

export type SupportMomentAggregateSource = {
  id: string;
  behaviorDate: string;
  behaviorType: string;
  supportCategory: string | null;
  quickReason: string | null;
  supportTags: string[] | null;
  generatedSummary: string | null;
  title: string;
  severity: string;
  followUpRequired?: boolean | null;
};

function nonEmpty(s: string | null | undefined): s is string {
  return Boolean(s?.trim());
}

/** Most frequent quick_reason / tag-like keys in the window. */
export function recentSupportThemes(
  records: SupportMomentAggregateSource[],
  limit = 5,
): string[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.quickReason?.trim() || r.supportCategory || r.behaviorType;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

/** Highlights positive recognition and low-severity strengths language. */
export function positiveGrowthTrends(
  records: SupportMomentAggregateSource[],
  limit = 4,
): string[] {
  const lines: string[] = [];
  for (const r of records) {
    if (r.behaviorType !== "positive_recognition" && r.supportCategory !== "positive_recognition") {
      continue;
    }
    const text = nonEmpty(r.generatedSummary)
      ? r.generatedSummary!.trim()
      : r.title.trim();
    if (text && !lines.includes(text)) lines.push(text);
    if (lines.length >= limit) break;
  }
  return lines;
}

/** Surfaces repeated support_tags entries. */
export function recurringStrategies(
  records: SupportMomentAggregateSource[],
  limit = 5,
): string[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const t of r.supportTags ?? []) {
      const k = t.trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/** Intervention / strategy / SEL / parent touchpoints. */
export function interventionSupportsUsed(
  records: SupportMomentAggregateSource[],
  limit = 6,
): string[] {
  const want = new Set([
    "intervention_followup",
    "participation",
    "social_emotional",
    "parent_contact",
  ]);
  const out: string[] = [];
  for (const r of records) {
    if (!want.has(r.behaviorType)) continue;
    const text = nonEmpty(r.generatedSummary)
      ? r.generatedSummary!.trim()
      : r.title.trim();
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}
