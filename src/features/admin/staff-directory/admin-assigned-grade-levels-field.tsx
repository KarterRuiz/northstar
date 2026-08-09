"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GradeInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";

const INVITE_FIELD_NAME = "gradeLevelIds";

type AdminStaffGradeLevelsFieldProps = {
  options: GradeInviteOption[];
  disabled?: boolean;
  /** Defaults to `gradeLevelIds` for invite / grade-access actions. */
  fieldName?: string;
  initialSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  label?: string;
  description?: string;
};

/**
 * Searchable multi-select for grade-level (program) access.
 * Distinct from class access — stores grade ids, not class ids.
 */
export function AdminStaffGradeLevelsField({
  options,
  disabled,
  fieldName = INVITE_FIELD_NAME,
  initialSelectedIds = [],
  onSelectedIdsChange,
  label = "Grade levels this staff member can access",
  description = "Program scope for this staff member. Class access is chosen separately below.",
}: AdminStaffGradeLevelsFieldProps) {
  const searchFieldId = useId();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialSelectedIds.filter((id) => options.some((o) => o.id === id)),
  );
  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const submittedIds = useMemo(
    () => selectedIds.filter((id) => optionById.has(id)),
    [selectedIds, optionById],
  );

  const selectedSet = useMemo(() => new Set(submittedIds), [submittedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = [o.name, o.code ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  const visibleNotSelectedCount = useMemo(
    () => filtered.filter((o) => !selectedSet.has(o.id)).length,
    [filtered, selectedSet],
  );

  const setIds = (next: string[]) => {
    setSelectedIds(next);
    onSelectedIdsChange?.(next);
  };

  const toggle = (id: string) => {
    setIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    for (const o of filtered) next.add(o.id);
    setIds([...next]);
  };

  const clearAll = () => setIds([]);

  return (
    <div className="space-y-3">
      {submittedIds.map((id) => (
        <input key={id} type="hidden" name={fieldName} value={id} />
      ))}
      <div className="space-y-1.5">
        <Label htmlFor={searchFieldId} className="text-foreground">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>
      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm">No grade levels are available yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={searchFieldId}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grade levels…"
              autoComplete="off"
              disabled={disabled}
              className="h-9 sm:flex-1"
            />
            <div className="flex shrink-0 gap-2">
              {filtered.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || visibleNotSelectedCount === 0}
                  onClick={selectAllVisible}
                >
                  Select all
                </Button>
              ) : null}
              {submittedIds.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={clearAll}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          <ScrollArea className="h-[min(14rem,35vh)] rounded-lg border">
            <div className="p-1" role="group" aria-label={label}>
              {filtered.length === 0 ? (
                <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                  No grade levels match your search.
                </p>
              ) : (
                filtered.map((o) => {
                  const checked = selectedSet.has(o.id);
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 transition-colors",
                        checked &&
                          "bg-accent/60 ring-primary/40 ring-offset-background ring-1 ring-offset-1",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="border-input text-primary focus-visible:ring-ring mt-0.5 h-4 w-4 shrink-0 rounded border shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(o.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block text-sm font-medium leading-snug">
                          {o.name}
                        </span>
                        {o.code ? (
                          <span className="text-muted-foreground block text-xs">{o.code}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <p className="text-muted-foreground text-xs">
            {submittedIds.length === 0
              ? "No grade levels selected."
              : `${submittedIds.length} grade level${submittedIds.length === 1 ? "" : "s"} selected.`}
          </p>
        </>
      )}
    </div>
  );
}
