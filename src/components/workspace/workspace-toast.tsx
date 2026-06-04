"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type WorkspaceToastState = {
  kind: "success" | "error";
  message: string;
} | null;

export function useWorkspaceToast(durationMs = 4000) {
  const [toast, setToast] = React.useState<WorkspaceToastState>(null);

  const showToast = React.useCallback(
    (kind: "success" | "error", message: string) => {
      setToast({ kind, message });
      window.setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  return { toast, showToast };
}

export function WorkspaceToast({ toast }: { toast: WorkspaceToastState }) {
  if (!toast) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2 text-sm",
        toast.kind === "success"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : "border-destructive/50 bg-destructive/10 text-destructive",
      )}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}

