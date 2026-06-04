"use client";

import { useCallback, useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type ReportCardDownloadButtonProps = {
  fileId: string;
  label?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export function ReportCardDownloadButton({
  fileId,
  label = "Download PDF",
  className,
  variant = "link",
  size = "sm",
}: ReportCardDownloadButtonProps) {
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/report-cards/${fileId}/signed-url`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res.json()) as {
        signedUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.signedUrl) {
        setPhase("error");
        setError(body.error ?? "Could not prepare download.");
        return;
      }
      window.open(body.signedUrl, "_blank", "noopener,noreferrer");
      setPhase("idle");
    } catch {
      setPhase("error");
      setError("Network error while requesting download.");
    }
  }, [fileId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={phase === "loading"}
        onClick={onClick}
      >
        {phase === "loading" ? "Preparing…" : label}
      </Button>
      {phase === "error" && error ? (
        <p className="text-destructive max-w-[14rem] text-right text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
