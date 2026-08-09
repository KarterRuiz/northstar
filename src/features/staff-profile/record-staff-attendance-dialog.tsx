"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/features/attendance/attendance-date-utils";
import {
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendanceStatus,
} from "@/features/staff-profile/constants";
import { staffAttendanceStatusLabels } from "@/features/staff-profile/staff-attendance-labels";
import {
  upsertStaffAttendanceAction,
  type StaffAttendanceActionState,
} from "@/features/staff-profile/staff-attendance-actions";

const selectClassName =
  "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

type RecordStaffAttendanceDialogProps = {
  staffMemberId: string;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: StaffAttendanceStatus | null;
  initialDate?: string;
  onSuccess?: (message: string) => void;
};

export function RecordStaffAttendanceDialog({
  staffMemberId,
  staffName,
  open,
  onOpenChange,
  initialStatus,
  initialDate,
  onSuccess,
}: RecordStaffAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <RecordStaffAttendanceForm
            key={`${staffMemberId}-${initialDate ?? "today"}-${initialStatus ?? "none"}`}
            staffMemberId={staffMemberId}
            staffName={staffName}
            initialStatus={initialStatus}
            initialDate={initialDate}
            onClose={() => onOpenChange(false)}
            onSuccess={(message) => {
              onSuccess?.(message);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecordStaffAttendanceForm({
  staffMemberId,
  staffName,
  initialStatus,
  initialDate,
  onClose,
  onSuccess,
}: {
  staffMemberId: string;
  staffName: string;
  initialStatus?: StaffAttendanceStatus | null;
  initialDate?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const handled = useRef(false);
  const [status, setStatus] = useState<StaffAttendanceStatus>(
    initialStatus && initialStatus !== "not_recorded" ? initialStatus : "present",
  );
  const [date, setDate] = useState(initialDate ?? todayIso());
  const [notes, setNotes] = useState("");

  const [state, formAction, pending] = useActionState<
    StaffAttendanceActionState | undefined,
    FormData
  >(upsertStaffAttendanceAction, undefined);

  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onSuccess(state.message ?? "Attendance saved.");
    }
  }, [state, onSuccess]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record staff attendance</DialogTitle>
        <DialogDescription>
          Presence for {staffName}. This is separate from student class attendance.
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="staffMemberId" value={staffMemberId} />
        <div className="space-y-1.5">
          <Label htmlFor="sa-date">Date</Label>
          <input
            id="sa-date"
            name="attendanceDate"
            type="date"
            className={selectClassName}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-status">Status</Label>
          <select
            id="sa-status"
            name="status"
            className={selectClassName}
            value={status}
            onChange={(e) => setStatus(e.target.value as StaffAttendanceStatus)}
            disabled={pending}
          >
            {STAFF_ATTENDANCE_STATUSES.filter((s) => s !== "not_recorded").map(
              (s) => (
                <option key={s} value={s}>
                  {staffAttendanceStatusLabels[s]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-notes">Notes (optional)</Label>
          <Textarea
            id="sa-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={pending}
          />
        </div>
        {state && !state.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
