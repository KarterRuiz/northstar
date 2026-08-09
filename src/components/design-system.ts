/**
 * NorthStar Design System V1.0 — Elite Teacher Experience
 * Consumption guide for feature agents.
 *
 * Own globals/tokens/shell/shared UI here. Feature pages should compose these
 * primitives — do not invent parallel color systems, card skins, or badge palettes.
 *
 * Tokens live in `src/app/globals.css` (`:root` + `@theme inline`).
 * Prefer semantic Tailwind classes: bg-background, bg-card, bg-surface-muted,
 * bg-primary, hover:bg-primary-hover, text-heading, text-muted-foreground,
 * text-meta-foreground, border-border, bg-row-hover, bg-success/10, etc.
 *
 * Typography utilities: ns-eyebrow, ns-page-title, ns-page-description,
 * ns-section-title, ns-card-title, ns-body, ns-muted, ns-meta,
 * ns-page-shell, ns-page-shell-wide, ns-table-primary, ns-transition.
 *
 * Layout chrome:
 * - WorkspacePageHeader / WorkspaceSectionHeader
 * - ListEmptyState / ProfileEmptyState (icon + short title + one sentence + optional action)
 * - DashboardShell / SidebarNav (nav groups: Workspace / People & Classes / Operations / System)
 * - DirectoryClickableRow / DirectoryPeopleCell / DirectoryToolbar (directory tables)
 *
 * UI primitives:
 * - Card (variants: default | metric | compact | muted | table | form | interactive)
 * - Button (default=primary, outline/secondary → navy hover, ghost, destructive)
 * - Badge (+ StatusBadge for Healthy / Needs attention / Error / Inactive / …)
 * - Table (+ TableRow clickable prop; use ns-table-primary on primary name cells)
 * - FormField / FormSection (panel prop for tinted #F8FAFC sections) / FormActions
 *
 * Motion: 150ms ease-out on buttons, rows, cards, nav, dropdowns.
 * Errors: use `@/lib/errors/safe-user-message` — never surface raw PostgREST/schema text.
 *
 * Import from `@/components/design-system` or the concrete module paths below.
 */

export {
  WorkspacePageHeader,
  WorkspaceSectionHeader,
} from "@/components/workspace/workspace-headers";
export { ListEmptyState } from "@/components/workspace/list-empty-state";
export {
  StatusBadge,
  statusKindLabel,
  statusKindVariant,
  STATUS_KINDS,
  type StatusKind,
} from "@/components/ui/status-badge";
export { FormField, FormSection, FormActions } from "@/components/ui/form-field";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
} from "@/components/ui/card";
export { Button, buttonVariants } from "@/components/ui/button";
export { Badge, badgeVariants } from "@/components/ui/badge";
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
