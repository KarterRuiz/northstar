"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

import {
  setParentRequestFollowUpDateAction,
  type FollowUpActionState,
} from "./follow-up-actions";
import { FollowUpFormSheet } from "./follow-up-form-sheet";
import type { FollowUpPrefill } from "./types";

export function ParentRequestFollowUpActions({
  parentRequestId,
  studentId,
  requesterName,
  existingDueOn,
}: {
  parentRequestId: string;
  studentId?: string;
  requesterName: string;
  existingDueOn?: string | null;
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [dateOpen, setDateOpen] = useState(false);
  const [dueOn, setDueOn] = useState(existingDueOn ?? "");
  const [state, formAction, pending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(setParentRequestFollowUpDateAction, undefined);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!state?.ok) return;
    if (handled.current === state.message) return;
    handled.current = state.message;
    showToast("success", state.message);
    setDateOpen(false);
    router.refresh();
  }, [state, router, showToast]);

  useEffect(() => {
    if (state && !state.ok) showToast("error", state.message);
  }, [state, showToast]);

  const prefill: FollowUpPrefill = {
    parentRequestId,
    parentRequestLabel: requesterName,
    studentId,
    category: "families",
    title: `Follow up on ${requesterName}'s request`,
  };

  return (
    <>
      <WorkspaceToast toast={toast} />
      <FollowUpFormSheet
        prefill={prefill}
        triggerLabel="Create Follow-Up"
        triggerVariant="outline"
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => setDateOpen(true)}>
        Set Follow-Up Date
      </Button>
      <Sheet open={dateOpen} onOpenChange={setDateOpen}>
        <SheetContent side="right" className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Set follow-up date</SheetTitle>
            <SheetDescription>
              Come back to this request on a specific day.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="parentRequestId" value={parentRequestId} />
            <div className="space-y-1.5">
              <Label htmlFor="parent-follow-up-date">Date</Label>
              <Input
                id="parent-follow-up-date"
                name="dueOn"
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            {state && !state.ok ? (
              <p className="text-destructive text-sm" role="alert">
                {state.message}
              </p>
            ) : null}
            <Button type="submit" disabled={pending || !dueOn}>
              {pending ? "Saving…" : "Save date"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
