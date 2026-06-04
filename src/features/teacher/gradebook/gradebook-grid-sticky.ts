/**
 * Gradebook sticky / frozen column utilities.
 *
 * Z-index map (within the scroll container only; keep opaque backgrounds so
 * sticky layers never show “see-through” stacking):
 *
 * | Layer | z-index | Elements |
 * |-------|---------|----------|
 * | Student corner | `z-50` | “Student” header (`sticky` top + left) — above header row and frozen name column |
 * | Header row | `z-40` | Assignment, category average, and overall header cells (`sticky top`) — stays above body on vertical scroll; above sticky name cells on horizontal scroll so assignment titles are not hidden behind names |
 * | Header cell chrome | `z-10` (local) | Wrapper inside assignment `<th>` (`relative` + z-10) so tooltips / ⋯ stay above cell content; must NOT replace `sticky` on the `<th>` itself (see pitfall below) |
 * | Frozen names | `z-30` | First-column body cells (`sticky left`) — above ordinary score cells |
 * | Scrollable body | auto | Score cells (not sticky) |
 *
 * Horizontal: assignment headers must not tuck under the frozen name strip (they sit above name cells).
 * Vertical: full header row stays above scrolling rows; the corner sits above the rest of the header row.
 *
 * **Pitfall — `position` on the same element as `sticky`:** `tailwind-merge` dedupes conflicting
 * `position:*` utilities. Putting `relative` on the same `<th>` as `headerRow` (`sticky top-0`)
 * drops stickiness (assignment headers scrolled while category/overall headers did not). Keep
 * `sticky` only on the table header cells; use `headerCellInteractive` on an inner wrapper for
 * positioned menus / stacking.
 *
 * **Ancestors:** Avoid `transform` on parents of the scroll container (new containing block).
 * Prefer a single `overflow-auto` scrollport for the grid; extra `overflow-hidden` wrappers around
 * it are usually unnecessary and can confuse clipping in some engines.
 */
export const GRADEBOOK_GRID_STICKY = {
  /** Shadow on the right edge of the frozen student column */
  edgeFrozenColumn:
    "shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_6px_-4px_rgba(0,0,0,0.35)]",
  studentCorner:
    "sticky left-0 top-0 z-50 min-w-[9.5rem] w-[9.5rem] max-w-[11rem] border-border/70 border-b border-r bg-background text-foreground dark:bg-background",
  headerRow:
    "sticky top-0 z-40 border-border/70 border-b border-r bg-background text-foreground dark:bg-background",
  /** Inner wrapper for assignment header tooltips / ⋯ — `relative` belongs here, not on `<th>`. */
  headerCellInteractive: "relative z-10",
  headerCategoryAvg:
    "sticky top-0 z-40 border-border/70 border-b border-r bg-muted text-foreground",
  studentBody:
    "sticky left-0 z-30 min-w-[9.5rem] w-[9.5rem] max-w-[11rem] border-border/70 border-b border-r bg-background text-foreground group-hover:bg-muted dark:bg-background",
} as const;
