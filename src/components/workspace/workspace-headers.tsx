import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspacePageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Small meta row under the description (links, hints). Keep sparse. */
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard page title block for dashboard workspaces.
 * Pattern: Eyebrow / Title / Description / Primary action.
 * Prefer this over bespoke h1 stacks. Keep description to one short sentence.
 */
export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  footer,
  actions,
  className,
}: WorkspacePageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <p className="ns-eyebrow">{eyebrow}</p>
        <h1 className="ns-page-title">{title}</h1>
        {description ? (
          <div className="ns-page-description">{description}</div>
        ) : null}
        {footer ? <div className="ns-meta pt-0.5">{footer}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-7">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceSectionHeaderProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Section / card group header. Prefer over duplicating muted helper stacks.
 */
export function WorkspaceSectionHeader({
  id,
  title,
  eyebrow,
  description,
  actions,
  className,
}: WorkspaceSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="ns-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className="ns-section-title">
          {title}
        </h2>
        {description ? (
          <div className="ns-muted max-w-2xl">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
