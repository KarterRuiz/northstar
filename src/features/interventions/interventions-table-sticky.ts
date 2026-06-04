/** Sticky left (student) / right (actions) column styles for horizontal scroll. */
export const INTERVENTIONS_TABLE_STICKY = {
  edgeLeft:
    "shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_6px_-4px_rgba(0,0,0,0.35)]",
  edgeRight:
    "shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.12)] dark:shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.35)]",
  studentHead:
    "sticky left-0 z-30 min-w-[10rem] max-w-[14rem] border-r border-border/70",
  studentCell:
    "sticky left-0 z-[11] min-w-[10rem] max-w-[14rem] border-r border-border/60 bg-background group-hover:bg-muted/55",
  actionsHead:
    "sticky right-0 z-30 min-w-[3rem] border-l border-border/70 md:min-w-[11rem]",
  actionsCell:
    "sticky right-0 z-[11] min-w-[3rem] border-l border-border/60 bg-background group-hover:bg-muted/55 md:min-w-[11rem]",
} as const;
