"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  formatFollowUpDue,
  isFollowUpOverdue,
  relatedContextLabel,
} from "./classify";
import { FOLLOW_UP_STATUS_LABELS } from "./constants";
import { FollowUpForm } from "./follow-up-form";
import { FollowUpRowActions } from "./follow-up-row-actions";
import type { FollowUpItem } from "./types";

export function FollowUpRow({
  item,
  today,
}: {
  item: FollowUpItem;
  today: string;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const context = relatedContextLabel(item);
  const dueLabel =
    item.status === "waiting" && !item.dueOn
      ? null
      : formatFollowUpDue(item.dueOn, today);
  const overdue = item.status !== "completed" && isFollowUpOverdue(item.dueOn, today);
  const showStatus =
    item.kind === "manual" || item.status === "waiting" || item.status === "completed";

  const body = (
    <>
      <p className="text-heading truncate text-sm font-medium leading-snug">{item.title}</p>
      <p className="ns-meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {context ? <span className="truncate">{context}</span> : null}
        {context && dueLabel ? <span aria-hidden>·</span> : null}
        {dueLabel ? (
          <span
            className={cn(overdue && "text-warning-foreground")}
            aria-label={overdue ? dueLabel : undefined}
          >
            {dueLabel}
          </span>
        ) : null}
      </p>
    </>
  );

  return (
    <li className="hover:bg-row-hover flex items-start gap-2 px-3 py-1.5 sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        {item.kind === "derived" && item.href ? (
          <Link
            href={item.href}
            className="block rounded-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            {body}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDetailOpen(true);
            }}
            className="w-full rounded-sm text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            {body}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:pt-0">
        {showStatus ? (
          <Badge
            variant={item.status === "waiting" ? "warning" : "muted"}
            aria-label={`Status: ${FOLLOW_UP_STATUS_LABELS[item.status]}`}
          >
            {FOLLOW_UP_STATUS_LABELS[item.status]}
          </Badge>
        ) : null}
        <FollowUpRowActions
          item={item}
          onEdit={
            item.kind === "manual"
              ? () => {
                  setEditing(true);
                  setDetailOpen(true);
                }
              : undefined
          }
        />
      </div>

      {item.kind === "manual" ? (
        <Sheet
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setEditing(false);
          }}
        >
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit follow-up" : item.title}</SheetTitle>
              <SheetDescription>
                {editing ? "Update the reminder." : "A reminder you asked to come back to."}
              </SheetDescription>
            </SheetHeader>
            {editing ? (
              <FollowUpForm item={item} onSuccess={() => setDetailOpen(false)} />
            ) : (
              <div className="space-y-4">
                <dl className="space-y-2 text-sm">
                  {context ? (
                    <div>
                      <dt className="ns-meta">Related</dt>
                      <dd className="text-heading">{context}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="ns-meta">When</dt>
                    <dd className={cn("text-heading", overdue && "text-warning-foreground")}>
                      {formatFollowUpDue(item.dueOn, today)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ns-meta">Status</dt>
                    <dd className="text-heading">{FOLLOW_UP_STATUS_LABELS[item.status]}</dd>
                  </div>
                  {item.note ? (
                    <div>
                      <dt className="ns-meta">Note</dt>
                      <dd className="text-heading whitespace-pre-wrap">{item.note}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  {item.href ? (
                    <Button type="button" size="sm" variant="ghost" asChild>
                      <Link href={item.href}>View related</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      ) : null}
    </li>
  );
}
