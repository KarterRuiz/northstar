"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyTextButtonProps = {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
};

export function CopyTextButton({
  text,
  label,
  copiedLabel = "Copied",
  variant = "outline",
  size = "sm",
  className,
}: CopyTextButtonProps) {
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={`gap-1.5 ${className ?? ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2200);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {done ? copiedLabel : label}
    </Button>
  );
}
