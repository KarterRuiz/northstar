"use client";

import Link from "next/link";
import { ChevronDown, Upload, UserPlus } from "lucide-react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StudentsAddMenuProps = {
  role: Role;
};

export function StudentsAddMenu({ role }: StudentsAddMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Add students">
          Add students
          <ChevronDown className="size-4 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" aria-label="Add students">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/${role}/students/new`} className="cursor-pointer">
            <UserPlus className="size-4" aria-hidden />
            Add single student
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/${role}/students/import`} className="cursor-pointer">
            <Upload className="size-4" aria-hidden />
            Import student roster
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
