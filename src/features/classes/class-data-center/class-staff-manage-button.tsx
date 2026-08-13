"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ClassTeachersEditDialog } from "@/features/classes/class-teachers-edit-dialog";
import type {
  ClassManagementClassRow,
  TeacherOption,
} from "@/features/classes/load-class-management-data";

export function ClassDataCenterStaffManageButton({
  klass,
  teachers,
}: {
  klass: ClassManagementClassRow;
  teachers: TeacherOption[];
}) {
  const [open, setOpen] = useState(false);
  const unavailable = teachers.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 lg:min-h-8"
        disabled={unavailable}
        title={
          unavailable
            ? "Add eligible staff in Teachers & Staff before assigning class teachers."
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        Manage teachers
      </Button>
      {!unavailable ? (
        <ClassTeachersEditDialog
          klass={klass}
          teachers={teachers}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
