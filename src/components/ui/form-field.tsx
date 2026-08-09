import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  id: string;
  label: ReactNode;
  /** Show required indicator */
  required?: boolean;
  /** Explicit optional hint (prefer omitting when most fields are required) */
  optional?: boolean;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Standard form field chrome: label, optional/required, help, control, error.
 * Keep copy approachable — avoid schema/implementation jargon in descriptions.
 *
 * Wire the control with `id`, and when needed:
 * `aria-invalid`, `aria-describedby={`${id}-description ${id}-error`}`.
 */
export function FormField({
  id,
  label,
  required,
  optional,
  description,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-heading font-medium">
          {label}
          {required ? (
            <span className="text-destructive ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {optional ? <span className="ns-meta">Optional</span> : null}
      </div>
      {description ? (
        <p id={`${id}-description`} className="ns-muted text-xs">
          {description}
        </p>
      ) : null}
      <div
        className={cn(
          error &&
            "[&_input]:border-destructive [&_textarea]:border-destructive [&_select]:border-destructive",
        )}
        data-invalid={error ? "true" : undefined}
      >
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormSectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** When true, wraps content in a tinted surface panel */
  panel?: boolean;
};

/** Groups related fields with calm spacing — use inside cards or page bodies. */
export function FormSection({
  title,
  description,
  children,
  className,
  actions,
  panel = false,
}: FormSectionProps) {
  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h3 className="ns-section-title">{title}</h3>
        {description ? (
          <p className="ns-muted max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (panel) {
    return (
      <section
        className={cn(
          "bg-surface-muted border-border space-y-4 rounded-xl border p-3.5 sm:p-4",
          className,
        )}
      >
        {header}
        <div className="space-y-3.5">{children}</div>
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)}>
      {header}
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

type FormActionsProps = {
  children: ReactNode;
  className?: string;
  /** Align primary action to the end (default) */
  align?: "start" | "end";
};

/** Save / cancel row — one obvious primary Button per form. */
export function FormActions({
  children,
  className,
  align = "end",
}: FormActionsProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center gap-2 border-t pt-4",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
