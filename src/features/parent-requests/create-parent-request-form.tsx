"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentProfileRow } from "@/features/parent-requests/load-assignment-profiles";
import {
  createParentRecordRequestAction,
  searchStudentsForParentRequestAction,
  type ParentRequestMutationState,
} from "@/features/parent-requests/parent-record-request-actions";

import {
  PARENT_REQUEST_DOCUMENT_TYPES,
  PARENT_REQUEST_STATUSES,
  parentRequestStatusLabel,
} from "./constants";

export function CreateParentRequestForm({
  dashboardRole,
  assignees,
  initialStudentId,
  initialStudentLabel,
}: {
  dashboardRole: Role;
  assignees: AssignmentProfileRow[];
  initialStudentId?: string;
  initialStudentLabel?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ParentRequestMutationState | undefined,
    FormData
  >(createParentRecordRequestAction, undefined);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ id: string; label: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(
    initialStudentId && initialStudentLabel
      ? { id: initialStudentId, label: initialStudentLabel }
      : initialStudentId
        ? { id: initialStudentId, label: initialStudentId.slice(0, 8) + "…" }
        : null,
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const t = window.setTimeout(() => {
      void searchStudentsForParentRequestAction(trimmed).then((res) => {
        if (res.ok) setHits(res.students);
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const trimmedQuery = query.trim();
  const visibleHits = trimmedQuery.length < 2 ? [] : hits;

  useEffect(() => {
    if (state?.ok && state.requestId) {
      router.push(
        `/dashboard/${dashboardRole}/parent-requests/${state.requestId}`,
      );
    }
  }, [state, router, dashboardRole]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New parent record request</CardTitle>
        <CardDescription>
          Log a formal records request from a parent or guardian. This workspace is visible
          only to leadership and registrar roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          <input type="hidden" name="dashboardRole" value={dashboardRole} />
          <input type="hidden" name="student_id" value={selected?.id ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="student-search">Find student</Label>
            <Input
              id="student-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type at least two characters…"
              autoComplete="off"
            />
            {visibleHits.length > 0 ? (
              <ul
                className="border-border bg-muted/40 max-h-48 overflow-auto rounded-md border text-sm"
                role="listbox"
              >
                {visibleHits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/80 w-full px-3 py-2 text-left"
                      onClick={() => {
                        setSelected({ id: h.id, label: h.label });
                        setQuery("");
                        setHits([]);
                      }}
                    >
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Selected:{" "}
              <span className="text-foreground font-medium">
                {selected ? selected.label : "None"}
              </span>
              {selected ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setSelected(null)}
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="requester_name">Requester name</Label>
              <Input id="requester_name" name="requester_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requester_email">Requester email</Label>
              <Input
                id="requester_email"
                name="requester_email"
                type="email"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="requester_relationship">Relationship</Label>
              <Input
                id="requester_relationship"
                name="requester_relationship"
                placeholder="e.g. Mother, guardian"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Initial status</Label>
              <select
                id="status"
                name="status"
                defaultValue="received"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {PARENT_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {parentRequestStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Requested documents</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PARENT_REQUEST_DOCUMENT_TYPES.map((d) => (
                <label
                  key={d.id}
                  className="border-border/80 bg-muted/30 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <input type="checkbox" name="documents" value={d.id} />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="assigned_to_profile_id">Assigned handler (optional)</Label>
            <select
              id="assigned_to_profile_id"
              name="assigned_to_profile_id"
              defaultValue=""
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <option value="">— Unassigned —</option>
              {assignees.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.full_name?.trim() || p.email?.trim() || p.id).slice(0, 80)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Reason / notes (family-facing)</Label>
            <textarea
              id="details"
              name="details"
              rows={4}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex min-h-[96px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              placeholder="What the family asked for and any context."
            />
          </div>

          {state && !state.ok ? (
            <p className="text-destructive text-sm" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !selected}>
              {pending ? "Saving…" : "Create request"}
            </Button>
            <Button variant="outline" type="button" asChild>
              <Link href={`/dashboard/${dashboardRole}/parent-requests`}>
                Cancel
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
