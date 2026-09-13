"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrentYearTermsSummary, TermListItem } from "@/features/school-settings/load-academic-structure-data";
import {
  ensureStandardTermsAction,
  updateTermDatesAction,
  type TermMutationState,
} from "@/features/school-settings/term-actions";
import { formatSchoolYearDate } from "@/features/school-settings/school-year-label";

function useMutationToast(
  state: TermMutationState | undefined,
  showToast: (kind: "success" | "error", message: string) => void,
) {
  const lastHandled = useRef<TermMutationState | undefined>(undefined);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      showToast("success", state.message ?? "Saved.");
    } else {
      showToast("error", state.error);
    }
  }, [state, showToast]);
}

function formatTermRange(term: TermListItem): string {
  if (!term.starts_on && !term.ends_on) return "Dates not set";
  if (term.starts_on && term.ends_on) {
    return `${formatSchoolYearDate(term.starts_on)} – ${formatSchoolYearDate(term.ends_on)}`;
  }
  if (term.starts_on) return `From ${formatSchoolYearDate(term.starts_on)} (end unset)`;
  return `Until ${formatSchoolYearDate(term.ends_on!)} (start unset)`;
}

function TermRow({
  term,
  showToast,
}: {
  term: TermListItem;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTermDatesAction, undefined);
  useMutationToast(state, showToast);

  const [closedFor, setClosedFor] = useState<typeof state>(undefined);
  if (state?.ok && state !== closedFor) {
    setClosedFor(state);
    if (open) setOpen(false);
  }

  return (
    <>
      <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {term.code} · {term.name}
            </span>
            {!term.starts_on || !term.ends_on ? (
              <Badge variant="muted">Dates unset</Badge>
            ) : null}
          </div>
          <p className="ns-meta">{formatTermRange(term)}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(true)}
        >
          Set dates
        </Button>
      </li>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {term.code} dates
            </DialogTitle>
            <DialogDescription>
              Leave blank until your school calendar is decided. Reporting treats
              unset end dates as not completed.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="termId" value={term.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`term-start-${term.id}`}>Starts on</Label>
                <Input
                  id={`term-start-${term.id}`}
                  name="startsOn"
                  type="date"
                  defaultValue={term.starts_on ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`term-end-${term.id}`}>Ends on</Label>
                <Input
                  id={`term-end-${term.id}`}
                  name="endsOn"
                  type="date"
                  defaultValue={term.ends_on ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save dates"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CurrentYearTermsPanel({
  summary,
  showToast,
}: {
  summary: CurrentYearTermsSummary | null;
  showToast: (kind: "success" | "error", message: string) => void;
}) {
  const [ensureState, ensureAction, ensurePending] = useActionState(
    ensureStandardTermsAction,
    undefined,
  );
  useMutationToast(ensureState, showToast);

  if (!summary) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="ns-card-title">Terms (T1–T4)</h3>
          <p className="ns-muted">
            Set a Current school year first, then create standard terms.
          </p>
        </div>
      </div>
    );
  }

  const needsScaffold = summary.missingCodes.length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="ns-card-title">Terms (T1–T4)</h3>
        <p className="ns-muted">
          Standard terms for {summary.schoolYearLabel}. Create scaffolding without
          inventing dates; set the calendar when school policy is ready.
        </p>
      </div>

      {needsScaffold ? (
        <div className="border-border bg-surface-muted space-y-3 rounded-xl border border-dashed px-3 py-4">
          <p className="ns-muted text-sm">
            Missing {summary.missingCodes.join(", ") || "T1–T4"} for the current year.
            Report cards and attendance cycle detection expect these codes.
          </p>
          <form action={ensureAction}>
            <input type="hidden" name="schoolYearId" value={summary.schoolYearId} />
            <Button type="submit" size="sm" disabled={ensurePending}>
              {ensurePending ? "Creating…" : "Create missing T1–T4"}
            </Button>
          </form>
        </div>
      ) : null}

      {summary.terms.length === 0 ? (
        <p className="ns-muted">No terms configured for the current year yet.</p>
      ) : (
        <ul className="border-border divide-border divide-y rounded-xl border bg-card shadow-xs">
          {summary.terms.map((term) => (
            <TermRow key={term.id} term={term} showToast={showToast} />
          ))}
        </ul>
      )}

      {!needsScaffold && summary.datesUnsetCount > 0 ? (
        <p className="ns-meta">
          {summary.datesUnsetCount} term
          {summary.datesUnsetCount === 1 ? "" : "s"} still need date ranges.
        </p>
      ) : null}
    </div>
  );
}
