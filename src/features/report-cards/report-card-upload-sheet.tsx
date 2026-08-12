"use client";

import { useState } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ReportCardUploadForm } from "@/features/report-cards/report-card-upload-form";

export function ReportCardUploadSheet({
  dashboardRole,
  suggestedSchoolYears,
  defaultTerm,
  studentId,
  studentLabel,
  studentMeta,
  triggerLabel = "Upload report card",
  triggerVariant = "outline",
}: {
  dashboardRole: Role;
  suggestedSchoolYears?: string[];
  defaultTerm?: string;
  studentId?: string;
  studentLabel?: string;
  studentMeta?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant={triggerVariant} size="sm">
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Upload report card</SheetTitle>
          <SheetDescription>
            Attach a PDF for a student, year, and term. Existing reports must be
            replaced on purpose.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto pr-1">
          <ReportCardUploadForm
            dashboardRole={dashboardRole}
            studentId={studentId}
            studentLabel={studentLabel}
            studentMeta={studentMeta}
            suggestedSchoolYears={suggestedSchoolYears}
            defaultTerm={defaultTerm}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
