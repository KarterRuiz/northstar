"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { GradebookAssignmentRow } from "./load-gradebook-data";

type GradebookAssignmentMenuProps = {
  assignment: GradebookAssignmentRow;
  disabled?: boolean;
  triggerClassName?: string;
  showEditItem?: boolean;
  onEdit: (assignment: GradebookAssignmentRow) => void;
  onDelete: (assignment: GradebookAssignmentRow) => void;
  onEnterScores: (assignmentId: string) => void;
};

export function GradebookAssignmentMenu({
  assignment,
  disabled,
  triggerClassName,
  showEditItem = true,
  onEdit,
  onDelete,
  onEnterScores,
}: GradebookAssignmentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={triggerClassName ?? "h-7 w-7 shrink-0"}
          disabled={disabled}
          aria-label={`Actions for ${assignment.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {showEditItem ? (
          <DropdownMenuItem onClick={() => onEdit(assignment)}>
            Edit assignment
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onEnterScores(assignment.id)}>
          Enter scores
        </DropdownMenuItem>
        {showEditItem ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(assignment)}
        >
          Delete assignment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
