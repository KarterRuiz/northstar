"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { BulkAddClassOption } from "./types";

type BulkAddClassSelectProps = {
  id: string;
  value: string;
  options: BulkAddClassOption[];
  onChange: (classId: string) => void;
  invalid?: boolean;
  disabled?: boolean;
};

export function BulkAddClassSelect({
  id,
  value,
  options,
  onChange,
  invalid,
  disabled,
}: BulkAddClassSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-8 w-full justify-between px-2 text-left text-xs font-normal",
            !selected && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          <span className="truncate">
            {selected ? selected.label : "Select class…"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search class, grade, year…"
          className="h-8 text-xs"
          aria-label="Search classes"
        />
        <div
          className="mt-2 max-h-56 overflow-y-auto"
          role="listbox"
          aria-label="Active classes"
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">
              No active classes match.
            </p>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                    isSelected && "bg-muted",
                  )}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 leading-snug">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
