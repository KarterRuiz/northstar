"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatInterventionDate } from "./format-intervention-date";

type FollowUpDateFieldProps = {
  id?: string;
  value: string | null;
  suggestedDate: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  onCustomize: () => void;
};

export function FollowUpDateField({
  id = "iv-followup",
  value,
  suggestedDate,
  disabled,
  onChange,
  onCustomize,
}: FollowUpDateFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const displayValue = value ?? "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          Follow-up date
        </Label>
        <p className="text-muted-foreground text-xs">
          Suggested:{" "}
          <span className="text-foreground font-medium">
            {formatInterventionDate(suggestedDate)}
          </span>
        </p>
      </div>

      <div className="relative min-w-0">
        <Input
          ref={inputRef}
          id={id}
          type="date"
          value={displayValue}
          disabled={disabled}
          className="pr-9"
          onChange={(e) => {
            onCustomize();
            onChange(e.target.value || null);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground absolute top-0 right-0 size-9 shrink-0"
          disabled={disabled}
          aria-label="Open calendar"
          onClick={() => {
            inputRef.current?.showPicker?.();
            inputRef.current?.focus();
          }}
        >
          <CalendarDays className="size-4" aria-hidden />
        </Button>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Suggested follow-up dates are based on intervention urgency and can be adjusted.
      </p>
    </div>
  );
}
