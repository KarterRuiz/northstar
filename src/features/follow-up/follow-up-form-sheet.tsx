"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { FollowUpForm } from "./follow-up-form";
import type { FollowUpItem, FollowUpPrefill } from "./types";

export function FollowUpFormSheet({
  item,
  prefill,
  triggerLabel = "Add Follow-Up",
  triggerVariant = "default",
  triggerSize = "sm",
  open: openProp,
  onOpenChange,
}: {
  item?: FollowUpItem;
  prefill?: FollowUpPrefill;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "sm" | "default";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!controlled ? (
        <SheetTrigger asChild>
          <Button type="button" variant={triggerVariant} size={triggerSize}>
            {triggerLabel}
          </Button>
        </SheetTrigger>
      ) : null}
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{item ? "Edit follow-up" : "Add Follow-Up"}</SheetTitle>
          <SheetDescription>
            A quiet reminder for something worth coming back to.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto pr-1">
          <FollowUpForm
            item={item}
            prefill={prefill}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
