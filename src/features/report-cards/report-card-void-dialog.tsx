"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  WorkspaceToast,
  useWorkspaceToast,
} from "@/components/workspace/workspace-toast";

import {
  voidGeneratedReportCardAction,
  type VoidGeneratedReportCardState,
} from "./void-generated-report-card-action";

type ReportCardVoidDialogProps = {
  fileId: string;
  dashboardRole: Role;
  label: string;
};

export function ReportCardVoidDialog({
  fileId,
  dashboardRole,
  label,
}: ReportCardVoidDialogProps) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [open, setOpen] = React.useState(false);
  const lastHandled = React.useRef<VoidGeneratedReportCardState | undefined>(
    undefined,
  );

  const [state, submit, pending] = useActionState<
    VoidGeneratedReportCardState | undefined,
    FormData
  >(voidGeneratedReportCardAction, undefined);

  React.useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      showToast("success", state.message ?? "Report card voided.");
      router.refresh();
    } else {
      showToast("error", state.message);
    }
  }, [state, router, showToast]);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Void
      </Button>
    );
  }

  return (
    <div className="border-destructive/40 bg-destructive/5 w-full max-w-sm space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Void generated report card</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {label} will be removed from final report card status but kept for audit.
      </p>
      <form action={submit} className="space-y-2">
        <input type="hidden" name="fileId" value={fileId} />
        <input type="hidden" name="dashboardRole" value={dashboardRole} />
        <textarea
          name="voidReason"
          required
          rows={2}
          placeholder="Reason (required)"
          className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="destructive" disabled={pending}>
            {pending ? "Voiding…" : "Confirm void"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
      <WorkspaceToast toast={toast} />
    </div>
  );
}
