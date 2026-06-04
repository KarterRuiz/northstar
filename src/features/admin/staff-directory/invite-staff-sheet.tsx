"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { roleLabels, roles, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createStaffInvitationAction,
  type StaffInvitationActionState,
} from "@/features/admin/staff-directory/staff-invitations-actions";

function InviteStaffFormBody({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<
    StaffInvitationActionState | undefined,
    FormData
  >(createStaffInvitationAction, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <p className="text-primary text-sm" role="status">
          {state.message ??
            "Invite email sent. After the staff member accepts, their dashboard role will be applied."}
        </p>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="invite-full-name">Full name</Label>
        <Input
          id="invite-full-name"
          name="fullName"
          autoComplete="name"
          required
          disabled={pending}
          placeholder="Jordan Lee"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Work email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="name@school.edu"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Dashboard role</Label>
        <select
          id="invite-role"
          name="role"
          required
          disabled={pending}
          defaultValue="teacher"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {roles.map((r: Role) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </div>
      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send invite email"}
      </Button>
    </form>
  );
}

export function InviteStaffSheet() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" className="gap-2">
          <UserPlus className="h-4 w-4" aria-hidden />
          Invite staff member
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Invite staff member</SheetTitle>
          <SheetDescription>
            Sends a Supabase invite email and records the invitation. If email delivery fails, the row
            stays pending so you can retry or use “Link existing auth user” below.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <InviteStaffFormBody
            onClose={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
