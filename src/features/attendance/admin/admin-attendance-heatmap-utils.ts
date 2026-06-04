export function formatHeatmapCellLabel(pct: number | null): string {
  return pct != null ? `${pct}%` : "—";
}

export function heatmapCellSurfaceClass(pct: number | null): string {
  if (pct == null) return "bg-muted/30 text-muted-foreground";
  if (pct >= 95) return "bg-emerald-500/10 text-foreground";
  if (pct >= 90) return "bg-emerald-500/5 text-foreground";
  if (pct >= 85) return "bg-amber-500/10 text-foreground";
  return "bg-destructive/10 text-foreground";
}
