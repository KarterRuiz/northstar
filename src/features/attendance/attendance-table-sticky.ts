/** Sticky column styles for attendance review tables (horizontal scroll). */
export const ATTENDANCE_TABLE_STICKY = {
  edgeLeft:
    "shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_6px_-4px_rgba(0,0,0,0.35)]",
  studentHead:
    "sticky left-0 z-30 min-w-[10rem] max-w-[14rem] border-r border-border/70",
  studentCell:
    "sticky left-0 z-[11] min-w-[10rem] max-w-[14rem] border-r border-border/60 bg-background group-hover:bg-muted/55",
} as const;

/** Sticky header cells inside the scroll container. */
export const ATTENDANCE_STICKY_TABLE_HEAD =
  "bg-muted/95 supports-[backdrop-filter]:bg-muted/80 sticky top-0 z-10 border-b border-border shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-sm";

/** Scroll region wrapping each attendance table. */
export const ATTENDANCE_TABLE_SCROLL =
  "max-h-[min(70vh,calc(100dvh-12rem))] overflow-auto overscroll-contain isolate md:max-h-[min(72vh,calc(100dvh-14rem))]";
