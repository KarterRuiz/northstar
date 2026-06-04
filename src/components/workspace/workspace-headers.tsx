import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspacePageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Small meta row under the description (links, hints). */
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

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
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {eyebrow}
        </p>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
            {description}
          </p>
        ) : null}
        {footer ? (
          <div className="text-muted-foreground pt-0.5 text-xs leading-snug">
            {footer}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
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
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className="text-foreground text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
