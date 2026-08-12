"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { addCalendarDays, todayForFollowUp } from "./classify";
import { FOLLOW_UP_CATEGORY_LABELS } from "./constants";
import {
  createFollowUpAction,
  updateFollowUpAction,
  type FollowUpActionState,
} from "./follow-up-actions";
import {
  FollowUpRelatedFields,
  type RelatedSelection,
} from "./follow-up-related-selectors";
import type { FollowUpCategory, FollowUpItem, FollowUpPrefill } from "./types";

function categoryFromRelated(related: RelatedSelection): FollowUpCategory {
  if (related.kind === "student") return "students";
  if (related.kind === "staff") return "staff";
  if (related.kind === "class") return "classes";
  if (related.kind === "parent_request") return "families";
  return "records";
}

function initialRelated(prefill?: FollowUpPrefill, item?: FollowUpItem): RelatedSelection {
  if (item) {
    if (item.related.studentId) {
      return { kind: "student", id: item.related.studentId, label: item.related.studentLabel };
    }
    if (item.related.staffMemberId) {
      return { kind: "staff", id: item.related.staffMemberId, label: item.related.staffLabel };
    }
    if (item.related.classId) {
      return { kind: "class", id: item.related.classId, label: item.related.classLabel };
    }
    if (item.related.parentRequestId) {
      return {
        kind: "parent_request",
        id: item.related.parentRequestId,
        label: item.related.parentRequestLabel,
      };
    }
  }
  if (prefill?.studentId) {
    return { kind: "student", id: prefill.studentId, label: prefill.studentLabel ?? null };
  }
  if (prefill?.staffMemberId) {
    return { kind: "staff", id: prefill.staffMemberId, label: prefill.staffLabel ?? null };
  }
  if (prefill?.classId) {
    return { kind: "class", id: prefill.classId, label: prefill.classLabel ?? null };
  }
  if (prefill?.parentRequestId) {
    return {
      kind: "parent_request",
      id: prefill.parentRequestId,
      label: prefill.parentRequestLabel ?? null,
    };
  }
  return { kind: "none", id: null, label: null };
}

type QuickWhen = "today" | "tomorrow" | "next_week" | "choose" | "none";

function whenFromDue(dueOn: string | null | undefined, today: string): QuickWhen {
  if (!dueOn) return "none";
  if (dueOn === today) return "today";
  if (dueOn === addCalendarDays(today, 1)) return "tomorrow";
  if (dueOn === addCalendarDays(today, 7)) return "next_week";
  return "choose";
}

export function FollowUpForm({
  item,
  prefill,
  onSuccess,
}: {
  item?: FollowUpItem;
  prefill?: FollowUpPrefill;
  onSuccess?: () => void;
}) {
  const action = item ? updateFollowUpAction : createFollowUpAction;
  const [state, formAction, pending] = useActionState<
    FollowUpActionState | undefined,
    FormData
  >(action, undefined);
  const handled = useRef(false);
  const today = todayForFollowUp();
  const [related, setRelated] = useState<RelatedSelection>(() =>
    initialRelated(prefill, item),
  );
  const [category, setCategory] = useState<FollowUpCategory>(
    item?.category ?? prefill?.category ?? categoryFromRelated(initialRelated(prefill, item)),
  );
  const defaultDue = item?.dueOn ?? prefill?.dueOn ?? "";
  const [when, setWhen] = useState<QuickWhen>(() => whenFromDue(defaultDue || null, today));
  const [chosenDate, setChosenDate] = useState(defaultDue);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onSuccess?.();
    }
  }, [state, onSuccess]);

  const defaultTitle = item?.title ?? prefill?.title ?? "";
  const defaultNote = item?.note ?? "";
  const waitingDefault = item?.status === "waiting";

  const dueValue =
    when === "today"
      ? today
      : when === "tomorrow"
        ? addCalendarDays(today, 1)
        : when === "next_week"
          ? addCalendarDays(today, 7)
          : when === "choose"
            ? chosenDate
            : "";

  const hiddenRelated = useMemo(() => {
    return {
      studentId: related.kind === "student" ? related.id : "",
      staffMemberId: related.kind === "staff" ? related.id : "",
      classId: related.kind === "class" ? related.id : "",
      parentRequestId: related.kind === "parent_request" ? related.id : "",
    };
  }, [related]);

  return (
    <form action={formAction} className="space-y-3.5">
      {item ? <input type="hidden" name="followUpId" value={item.id} /> : null}
      <input type="hidden" name="studentId" value={hiddenRelated.studentId ?? ""} />
      <input type="hidden" name="staffMemberId" value={hiddenRelated.staffMemberId ?? ""} />
      <input type="hidden" name="classId" value={hiddenRelated.classId ?? ""} />
      <input type="hidden" name="parentRequestId" value={hiddenRelated.parentRequestId ?? ""} />
      <input type="hidden" name="dueOn" value={dueValue} />
      {item ? null : <input type="hidden" name="category" value={category} />}

      <div className="space-y-1.5">
        <Label htmlFor="follow-up-title">What do you want to remember?</Label>
        <Input
          id="follow-up-title"
          name="title"
          required
          defaultValue={defaultTitle}
          disabled={pending}
          placeholder="Call back after the meeting"
          autoFocus={!item}
        />
      </div>

      <FollowUpRelatedFields
        value={related}
        disabled={pending}
        onChange={(next) => {
          setRelated(next);
          if (!item) setCategory(categoryFromRelated(next));
        }}
      />

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">When</legend>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["next_week", "Next week"],
              ["choose", "Choose date"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => setWhen(id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                when === id
                  ? "border-heading bg-heading text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-heading/40 hover:text-heading",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {when === "choose" ? (
          <Input
            type="date"
            value={chosenDate}
            onChange={(e) => setChosenDate(e.target.value)}
            disabled={pending}
            aria-label="Choose a date"
          />
        ) : null}
      </fieldset>

      {item ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="follow-up-status">Status</Label>
            <select
              id="follow-up-status"
              name="status"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-xs"
              defaultValue={waitingDefault ? "waiting" : "open"}
              disabled={pending}
            >
              <option value="open">Open</option>
              <option value="waiting">Waiting</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="follow-up-category">Category</Label>
            <select
              id="follow-up-category"
              name="category"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value as FollowUpCategory)}
              disabled={pending}
            >
              {Object.entries(FOLLOW_UP_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="follow-up-note">Note</Label>
        <Textarea
          id="follow-up-note"
          name="note"
          rows={2}
          defaultValue={defaultNote}
          disabled={pending}
          placeholder="Optional context for when you return."
        />
      </div>

      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Add follow-up"}
        </Button>
      </div>
    </form>
  );
}
