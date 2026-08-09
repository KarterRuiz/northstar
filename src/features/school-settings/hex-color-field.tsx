"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isValidHexColor, normalizeOptionalHexColor } from "@/lib/school-settings/validation";

type HexColorFieldProps = {
  id: string;
  name: string;
  label: string;
  description?: string;
  defaultValue: string;
  fallback: string;
};

function toPickerValue(value: string, fallback: string): string {
  const normalized = normalizeOptionalHexColor(value);
  return normalized || fallback;
}

export function HexColorField({
  id,
  name,
  label,
  description,
  defaultValue,
  fallback,
}: HexColorFieldProps) {
  const initial = toPickerValue(defaultValue, fallback);
  const [hex, setHex] = React.useState(initial);
  const [touched, setTouched] = React.useState(false);

  const normalized = normalizeOptionalHexColor(hex);
  const valid = isValidHexColor(hex) && hex.trim() !== "" && Boolean(normalized);
  const swatch = valid ? normalized : fallback;
  const showError = touched && !valid;
  // Always submit normalized #rrggbb when valid so stored format stays consistent.
  const submitValue = valid ? normalized : hex.trim();

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-hex`}>{label}</Label>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={`${id}-picker`}
          className={cn(
            "border-border relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-sm",
            "focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2",
          )}
          title={`Choose ${label.toLowerCase()}`}
        >
          <span className="sr-only">Open color picker for {label}</span>
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundColor: swatch }}
          />
          <input
            id={`${id}-picker`}
            type="color"
            value={swatch}
            onChange={(event) => {
              setHex(event.target.value.toLowerCase());
              setTouched(true);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={`${id}-hex`}
            value={hex}
            onChange={(event) => {
              setHex(event.target.value);
              setTouched(true);
            }}
            onBlur={() => {
              setTouched(true);
              const next = normalizeOptionalHexColor(hex);
              if (next) setHex(next);
            }}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            placeholder={fallback}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? `${id}-error` : `${id}-hint`}
            className={cn(
              "font-mono uppercase tracking-wide",
              showError && "border-destructive focus-visible:ring-destructive",
            )}
          />
          <input type="hidden" name={name} value={submitValue} readOnly />
          {showError ? (
            <p id={`${id}-error`} className="text-destructive text-xs" role="alert">
              Enter a 6-digit hex color such as {fallback}.
            </p>
          ) : (
            <p id={`${id}-hint`} className="text-muted-foreground text-xs">
              Hex format #RRGGBB · selected {swatch.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
