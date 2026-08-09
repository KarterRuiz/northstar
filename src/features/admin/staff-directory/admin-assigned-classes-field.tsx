"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ClassInviteOption } from "@/features/admin/staff-directory/load-classes-for-staff-invite";

/** Primary line aligned with staff directory class table (year · grade · class). */
export function formatAdminClassChipPrimary(c: ClassInviteOption): string {
  return `${c.schoolYearLabel} · ${c.gradeName} · ${c.className}`;
}

function formatAdminClassChipSecondary(c: ClassInviteOption): string | null {
  if (!c.section) return null;
  return `§ ${c.section}`;
}

function optionMatchesQuery(c: ClassInviteOption, q: string): boolean {
  if (!q) return true;
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const hay = [
    c.label,
    c.schoolYearLabel,
    c.gradeName,
    c.className,
    c.section ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

type GroupedRow =
  | { type: "header"; key: string; gradeName: string }
  | { type: "class"; key: string; option: ClassInviteOption };

function buildGroupedRows(options: ClassInviteOption[]): GroupedRow[] {
  const rows: GroupedRow[] = [];
  let lastGrade: string | null = null;
  for (const option of options) {
    if (option.gradeName !== lastGrade) {
      lastGrade = option.gradeName;
      rows.push({ type: "header", key: `h-${option.gradeLevelId}-${option.gradeName}`, gradeName: option.gradeName });
    }
    rows.push({ type: "class", key: option.id, option });
  }
  return rows;
}

type ClassSearchListProps = {
  options: ClassInviteOption[];
  search: string;
  /** Ids to omit from the list (e.g. already selected on invite, or assigned in directory). */
  excludeIds?: Set<string>;
  onPick: (id: string) => void;
  emptyLabel?: string;
};

function ClassSearchList({
  options,
  search,
  excludeIds,
  onPick,
  emptyLabel = "No classes match your search.",
}: ClassSearchListProps) {
  const filtered = useMemo(() => {
    return options.filter((o) => {
      if (excludeIds?.has(o.id)) return false;
      return optionMatchesQuery(o, search);
    });
  }, [options, search, excludeIds]);

  const grouped = useMemo(() => buildGroupedRows(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyLabel}</p>
    );
  }

  return (
    <div className="pb-1">
      {grouped.map((row) => {
        if (row.type === "header") {
          return (
            <div
              key={row.key}
              className="bg-popover text-muted-foreground sticky top-0 z-[1] border-b px-3 py-2 text-xs font-semibold tracking-wide"
            >
              {row.gradeName}
            </div>
          );
        }
        const o = row.option;
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => onPick(o.id)}
            className="hover:bg-accent/80 flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors"
          >
            <span className="min-w-0 flex-1">
              <span className="text-foreground block font-medium leading-snug">{formatAdminClassChipPrimary(o)}</span>
              {formatAdminClassChipSecondary(o) ? (
                <span className="text-muted-foreground block text-xs">{formatAdminClassChipSecondary(o)}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type ClassSearchPopoverProps = {
  options: ClassInviteOption[];
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  excludeIds?: Set<string>;
  onPick: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  emptyLabel?: string;
  contentClassName?: string;
};

function ClassSearchPopover({
  options,
  trigger,
  align = "start",
  excludeIds,
  onPick,
  onOpenChange,
  emptyLabel,
  contentClassName,
}: ClassSearchPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className={cn(
          "flex w-[min(calc(100vw-2rem),24rem)] flex-col gap-0 overflow-hidden p-0",
          contentClassName,
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by year, grade, or class…"
            autoComplete="off"
            aria-label="Search classes"
            className="h-9"
          />
        </div>
        <ScrollArea className="h-[min(18rem,50vh)]">
          <ClassSearchList
            options={options}
            search={search}
            excludeIds={excludeIds}
            onPick={(id) => {
              onPick(id);
              handleOpen(false);
            }}
            emptyLabel={emptyLabel}
          />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const INVITE_FIELD_NAME = "classIds";

type AdminTeacherInviteAssignedClassesProps = {
  options: ClassInviteOption[];
  disabled?: boolean;
  /** Defaults to `classIds` for `createStaffInvitationAction` / `parsePendingClassIds`. */
  fieldName?: string;
  /** When set, only classes in these grade levels are listed (invite grade → class flow). */
  allowedGradeLevelIds?: string[];
  initialSelectedIds?: string[];
};

/**
 * Admin-only: assigns pending classes on a teacher staff invitation (stored in
 * `staff_invitations.pending_class_ids`). Not shown to teachers.
 */
export function AdminTeacherInviteAssignedClasses({
  options,
  disabled,
  fieldName = INVITE_FIELD_NAME,
  allowedGradeLevelIds,
  initialSelectedIds = [],
}: AdminTeacherInviteAssignedClassesProps) {
  const searchFieldId = useId();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  const allowedSet = useMemo(() => {
    if (allowedGradeLevelIds == null) return null;
    return new Set(allowedGradeLevelIds);
  }, [allowedGradeLevelIds]);

  const scopedOptions = useMemo(() => {
    if (!allowedSet) return options;
    return options.filter((o) => allowedSet.has(o.gradeLevelId));
  }, [options, allowedSet]);

  const optionById = useMemo(
    () => new Map(scopedOptions.map((o) => [o.id, o])),
    [scopedOptions],
  );

  const optionByIdAll = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  // Keep selections in state; only submit those still in the grade filter.
  // Parked (out-of-filter) selections are called out so they are not silently lost.
  const submittedIds = useMemo(() => {
    return selectedIds.filter((id) => optionById.has(id));
  }, [selectedIds, optionById]);

  const parkedIds = useMemo(() => {
    return selectedIds.filter((id) => optionByIdAll.has(id) && !optionById.has(id));
  }, [selectedIds, optionById, optionByIdAll]);

  const selectedSet = useMemo(() => new Set(submittedIds), [submittedIds]);

  const filtered = useMemo(
    () => scopedOptions.filter((o) => optionMatchesQuery(o, search)),
    [scopedOptions, search],
  );

  const groupedFiltered = useMemo(() => buildGroupedRows(filtered), [filtered]);

  const visibleNotSelectedCount = useMemo(
    () => filtered.filter((o) => !selectedSet.has(o.id)).length,
    [filtered, selectedSet],
  );

  const gradesNeedSelection = allowedSet != null && allowedSet.size === 0;

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const o of filtered) next.add(o.id);
      return [...next];
    });
  };

  const selectAllInGrade = (gradeName: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const o of filtered) {
        if (o.gradeName === gradeName) next.add(o.id);
      }
      return [...next];
    });
  };

  const clearAll = () => setSelectedIds([]);

  return (
    <div className="space-y-3">
      {submittedIds.map((id) => (
        <input key={id} type="hidden" name={fieldName} value={id} />
      ))}
      <div className="space-y-1.5">
        <Label htmlFor={searchFieldId} className="text-foreground">
          Classes this staff member can access
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Exact classes they teach or can open after signing in. Filtered by the grade levels above.
        </p>
      </div>
      {parkedIds.length > 0 ? (
        <p className="text-amber-900 dark:text-amber-100 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed">
          {parkedIds.length} previously selected class
          {parkedIds.length === 1 ? "" : "es"}{" "}
          {parkedIds.length === 1 ? "is" : "are"} hidden because{" "}
          {parkedIds.length === 1 ? "its" : "their"} grade level
          {parkedIds.length === 1 ? " is" : "s are"} no longer selected. Re-select those grades to
          keep {parkedIds.length === 1 ? "it" : "them"}, or save to drop{" "}
          {parkedIds.length === 1 ? "it" : "them"} from this staff member.
        </p>
      ) : null}
      {gradesNeedSelection ? (
        <p className="text-muted-foreground text-sm">
          Select one or more grade levels first to choose classes.
        </p>
      ) : scopedOptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No active classes match the selected grade levels.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={searchFieldId}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class, grade, or school year…"
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
                  Select all visible
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
          <ScrollArea className="h-[min(20rem,45vh)] rounded-lg border">
            <div className="p-1" role="group" aria-label="Classes this staff member can access">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                  No classes match your search.
                </p>
              ) : (
                groupedFiltered.map((row) => {
                  if (row.type === "header") {
                    return (
                      <div
                        key={row.key}
                        className="bg-background text-muted-foreground sticky top-0 z-[1] flex items-center justify-between gap-2 border-b px-3 py-2 text-xs font-semibold tracking-wide"
                      >
                        <span>{row.gradeName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 px-2 text-xs font-medium"
                          disabled={disabled}
                          onClick={() => selectAllInGrade(row.gradeName)}
                        >
                          Select all in grade
                        </Button>
                      </div>
                    );
                  }
                  const o = row.option;
                  const checked = selectedSet.has(o.id);
                  const secondary = formatAdminClassChipSecondary(o);
                  return (
                    <label
                      key={row.key}
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
                          {formatAdminClassChipPrimary(o)}
                        </span>
                        {secondary ? (
                          <span className="text-muted-foreground block text-xs">{secondary}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Saved on the roster and applied when they activate. Teachers do not pick their own
            classes here.
          </p>
        </>
      )}
    </div>
  );
}

type AdminStaffDirectoryClassPickerProps = {
  id: string;
  options: ClassInviteOption[];
  value: string;
  onValueChange: (classId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Searchable single class picker for admin staff directory forms (e.g. add `class_teachers` row).
 */
export function AdminStaffDirectoryClassPicker({
  id,
  options,
  value,
  onValueChange,
  disabled,
  placeholder = "Search classes to add…",
}: AdminStaffDirectoryClassPickerProps) {
  const selected = value ? options.find((o) => o.id === value) : undefined;
  const triggerLabel = selected ? selected.label : placeholder;

  return (
    <ClassSearchPopover
      options={options}
      onPick={onValueChange}
      emptyLabel="No classes match your search."
      trigger={
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled || options.length === 0}
          className="h-auto min-h-9 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
        >
          <span className={cn("line-clamp-2 min-w-0 flex-1 text-sm", !selected && "text-muted-foreground")}>
            {options.length === 0 ? "No classes available" : triggerLabel}
          </span>
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      }
    />
  );
}
