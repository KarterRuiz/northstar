"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";

import { CreateInterventionSheet } from "./create-intervention-sheet";

type InterventionsProfileToolbarProps = {
  studentId: string;
  classId: string;
  studentName: string;
};

export function InterventionsProfileToolbar({
  studentId,
  classId,
  studentName,
}: InterventionsProfileToolbarProps) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <WorkspaceToast toast={toast} />
      <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add intervention
      </Button>
      <CreateInterventionSheet
        open={open}
        onOpenChange={setOpen}
        studentId={studentId}
        classId={classId}
        studentName={studentName}
        onCreated={() => {
          setOpen(false);
          showToast("success", "Intervention added");
          router.refresh();
        }}
      />
    </>
  );
}
