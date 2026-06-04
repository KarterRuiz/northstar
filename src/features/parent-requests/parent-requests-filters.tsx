"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  PARENT_REQUEST_STATUSES,
  parentRequestStatusLabel,
  type ParentRequestStatus,
} from "./constants";

export function ParentRequestsFilters({
  roleBasePath,
  defaultStatus,
  defaultStudentSearch,
}: {
  roleBasePath: string;
  defaultStatus?: ParentRequestStatus;
  defaultStudentSearch?: string;
}) {
  const router = useRouter();

  return (
    <form
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const status = String(fd.get("status") ?? "").trim();
        const student_q = String(fd.get("student_q") ?? "").trim();
        const params = new URLSearchParams();
        if (status.length > 0) params.set("status", status);
        if (student_q.length > 0) params.set("student_q", student_q);
        const qs = params.toString();
        router.push(qs ? `${roleBasePath}?${qs}` : roleBasePath);
      }}
    >
      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
        <Label htmlFor="pr-status">Status</Label>
        <select
          id="pr-status"
          name="status"
          defaultValue={defaultStatus ?? ""}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <option value="">All statuses</option>
          {PARENT_REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {parentRequestStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[12rem] flex-[2] flex-col gap-1.5">
        <Label htmlFor="pr-student">Student search</Label>
        <Input
          id="pr-student"
          name="student_q"
          placeholder="Name or student number…"
          defaultValue={defaultStudentSearch ?? ""}
          autoComplete="off"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Apply filters</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.push(roleBasePath);
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
