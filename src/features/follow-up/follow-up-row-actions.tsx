"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkspaceToast, useWorkspaceToast } from "@/components/workspace/workspace-toast";

import {
  completeFollowUpAction,
  reopenFollowUpAction,
  rescheduleFollowUpAction,
  setFollowUpWaitingAction,
  type FollowUpActionState,
} from "./follow-up-actions";
import { FollowUpForm } from "./follow-up-form";
import { FollowUpFormSheet } from "./follow-up-form-sheet";
import {
  canCompleteFollowUp,
  canEditFollowUp,
  prefillFromFollowUpItem,
} from "./classify";
import type { FollowUpItem } from "./types";

function sourceRecordLabel(item: FollowUpItem): string {
  switch (item.sourceType) {
    case "attendance_missing_class":
    case "attendance_student":
      return "View attendance";
    case "parent_request_open":
      return "View request";
    case "staff_pending_invite":
    case "staff_draft_missing_email":
      return "View staff";
    case "report_cards_missing":
      return "View report cards";
    case "transition_note_submitted":
      return "View transition note";
    default:
      return "View record";
  }
}

export function FollowUpRowActions({
  item,
  onEdit,
}: {
  item: FollowUpItem;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [editOpen, setEditOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [chosenDate, setChosenDate] = useState(item.dueOn ?? "");

  const [completeState, completeAction, completePending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(completeFollowUpAction, undefined);
  const [waitState, waitAction, waitPending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(setFollowUpWaitingAction, undefined);
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(rescheduleFollowUpAction, undefined);
  const [reopenState, reopenAction, reopenPending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(reopenFollowUpAction, undefined);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    const state = completeState ?? waitState ?? rescheduleState ?? reopenState;
    if (!state?.ok) return;
    const key = state.message;
    if (handled.current === key) return;
    handled.current = key;
    showToast("success", state.message);
    setDateOpen(false);
    router.refresh();
  }, [completeState, waitState, rescheduleState, reopenState, router, showToast]);

  useEffect(() => {
    const err =
      (completeState && !completeState.ok && completeState.message) ||
      (waitState && !waitState.ok && waitState.message) ||
      (rescheduleState && !rescheduleState.ok && rescheduleState.message) ||
      (reopenState && !reopenState.ok && reopenState.message);
    if (err) showToast("error", err);
  }, [completeState, waitState, rescheduleState, reopenState, showToast]);

  const pending = completePending || waitPending || reschedulePending || reopenPending;
  const isManual = canEditFollowUp(item.kind);
  const isOpen = item.status === "open";
  const isWaiting = item.status === "waiting";
  const isCompleted = item.status === "completed";

  function run(action: (fd: FormData) => void, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("followUpId", item.id);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    }
    action(fd);
  }

  return (
    <>
      <WorkspaceToast toast={toast} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={pending}
            aria-label={`Actions for ${item.title}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {item.kind === "derived" && item.href ? (
            <DropdownMenuItem asChild>
              <Link href={item.href}>{sourceRecordLabel(item)}</Link>
            </DropdownMenuItem>
          ) : null}
          {item.kind === "derived" ? (
            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              Create manual follow-up
            </DropdownMenuItem>
          ) : null}

          {isManual && canCompleteFollowUp(item.kind) && !isCompleted ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(completeAction)}>
              Complete
            </DropdownMenuItem>
          ) : null}
          {isManual && isOpen ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(waitAction)}>
              Mark waiting
            </DropdownMenuItem>
          ) : null}
          {isManual && (isWaiting || isCompleted) ? (
            <DropdownMenuItem disabled={pending} onSelect={() => run(reopenAction)}>
              Reopen
            </DropdownMenuItem>
          ) : null}
          {isManual && !isCompleted ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => run(rescheduleAction, { reschedule: "tomorrow" })}
              >
                Reschedule — tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => run(rescheduleAction, { reschedule: "next_week" })}
              >
                Reschedule — next week
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDateOpen(true)}>
                Reschedule — choose date
              </DropdownMenuItem>
            </>
          ) : null}
          {isManual ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  if (onEdit) onEdit();
                  else setEditOpen(true);
                }}
              >
                Edit
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit follow-up</SheetTitle>
            <SheetDescription>Update the reminder.</SheetDescription>
          </SheetHeader>
          <FollowUpForm item={item} onSuccess={() => setEditOpen(false)} />
        </SheetContent>
      </Sheet>

      <FollowUpFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefill={prefillFromFollowUpItem(item)}
      />

      <Sheet open={dateOpen} onOpenChange={setDateOpen}>
        <SheetContent side="right" className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Choose a date</SheetTitle>
            <SheetDescription>Move this follow-up to another day.</SheetDescription>
          </SheetHeader>
          <form
            className="space-y-4"
            action={(fd) => {
              fd.set("followUpId", item.id);
              fd.set("dueOn", chosenDate);
              rescheduleAction(fd);
            }}
          >
            <Input
              type="date"
              value={chosenDate}
              onChange={(e) => setChosenDate(e.target.value)}
              required
              aria-label="New date"
            />
            <Button type="submit" disabled={pending || !chosenDate}>
              {pending ? "Saving…" : "Reschedule"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
