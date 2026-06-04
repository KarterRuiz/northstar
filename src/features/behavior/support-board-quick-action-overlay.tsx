"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FocusScope } from "@radix-ui/react-focus-scope";

import { cn } from "@/lib/utils";

import { SupportBoardChipPanel } from "./support-board-chip-panel";
import { supportBoardActionLabels, type SupportBoardAction } from "./support-board-chips";
import type { BehaviorStudentOption } from "./schema";

const OVERLAY_Z_BACKDROP = 70;
const OVERLAY_Z_PANEL = 71;

const panelChromeByAction: Record<SupportBoardAction, string> = {
  positive:
    "border-emerald-400/40 bg-white/75 shadow-emerald-500/10 ring-1 ring-emerald-500/15 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:ring-emerald-400/20",
  concern:
    "border-amber-400/45 bg-white/75 shadow-amber-500/10 ring-1 ring-amber-500/15 dark:border-amber-500/35 dark:bg-amber-950/35 dark:ring-amber-400/20",
  strategy:
    "border-sky-400/45 bg-white/75 shadow-sky-500/10 ring-1 ring-sky-500/15 dark:border-sky-500/35 dark:bg-sky-950/40 dark:ring-sky-400/20",
  parent:
    "border-violet-400/45 bg-white/75 shadow-violet-500/10 ring-1 ring-violet-500/15 dark:border-violet-500/35 dark:bg-violet-950/40 dark:ring-violet-400/20",
};

function useAnchorRect(
  anchorRef: React.RefObject<HTMLButtonElement | null>,
  open: boolean,
): { top: number; left: number; width: number; height: number } | null {
  const [rect, setRect] = React.useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const measure = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el || !open) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [anchorRef, open]);

  React.useLayoutEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setRect(null);
      });
      return;
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return open ? rect : null;
}

function panelPositionStyle(
  rect: { top: number; left: number; width: number; height: number },
): React.CSSProperties {
  const margin = 8;
  const gap = 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxW = Math.min(380, vw - margin * 2);
  const anchorCenterX = rect.left + rect.width / 2;
  const spaceAbove = rect.top - margin - gap;
  const minAbove = 140;
  const placeBelow = spaceAbove < minAbove;
  const anchorBottom = rect.top + rect.height;

  let left = anchorCenterX - maxW / 2;
  left = Math.max(margin, Math.min(left, vw - maxW - margin));

  if (placeBelow) {
    return {
      position: "fixed",
      top: anchorBottom + gap,
      left,
      width: maxW,
      maxHeight: Math.min(0.7 * vh, vh - anchorBottom - gap - margin),
      zIndex: OVERLAY_Z_PANEL,
    };
  }

  return {
    position: "fixed",
    left,
    bottom: vh - rect.top + gap,
    width: maxW,
    maxHeight: Math.min(0.7 * vh, spaceAbove),
    zIndex: OVERLAY_Z_PANEL,
  };
}

export type SupportBoardQuickActionOverlayProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  classId: string;
  student: BehaviorStudentOption | null;
  action: SupportBoardAction | null;
  note: string;
  onNoteChange: (value: string) => void;
  disabled?: boolean;
  onChip: (quickReasonKey: string) => void;
  onDismiss: () => void;
};

export function SupportBoardQuickActionOverlay({
  open,
  anchorRef,
  classId,
  student,
  action,
  note,
  onNoteChange,
  disabled,
  onChip,
  onDismiss,
}: SupportBoardQuickActionOverlayProps) {
  const reduceMotion = useReducedMotion();
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => true, []),
    React.useCallback(() => false, []),
  );
  const panelRef = React.useRef<HTMLDivElement>(null);
  const rect = useAnchorRect(anchorRef, open && mounted);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  React.useLayoutEffect(() => {
    if (!open || !rect || !panelRef.current) return;
    panelRef.current.focus({ preventScroll: true });
  }, [open, rect, action, student?.id]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  const titleId = "support-board-quick-overlay-title";
  const panelId = "support-board-quick-overlay-panel";

  const portal =
    open && student && action && rect ? (
      <>
        <motion.div
          key="support-quick-backdrop"
          role="presentation"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className="fixed inset-0 bg-slate-950/10 dark:bg-slate-950/40"
          style={{ zIndex: OVERLAY_Z_BACKDROP }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onDismiss();
          }}
        />
        <FocusScope trapped loop>
          <motion.div
            key={`${student.id}-${action}`}
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0.12, ease: [0.22, 1, 0.36, 1] }
                : { type: "spring", stiffness: 380, damping: 34, mass: 0.75 }
            }
            className={cn(
              "max-h-[min(70vh,calc(100dvh-16px))] overflow-y-auto overscroll-contain rounded-2xl border p-4 shadow-2xl sm:p-5",
              "bg-white/95 dark:bg-slate-950/90",
              "outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
              panelChromeByAction[action],
            )}
            style={{
              ...panelPositionStyle(rect),
              willChange: "transform, opacity",
            }}
          >
            <h2 id={titleId} className="sr-only">
              {supportBoardActionLabels[action]} — {student.label}
            </h2>
            <SupportBoardChipPanel
              variant="inline"
              action={action}
              studentName={student.label}
              idPrefix={student.id}
              suggestionContext={{ classId, studentId: student.id }}
              disabled={disabled}
              note={note}
              onNoteChange={onNoteChange}
              onChip={onChip}
            />
          </motion.div>
        </FocusScope>
      </>
    ) : null;

  return createPortal(portal, document.body);
}
