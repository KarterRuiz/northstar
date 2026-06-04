"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { BehaviorLogRow } from "./load-behavior-page-data";

const ClassroomMemoryFeed = dynamic(
  () => import("./classroom-memory-feed").then((m) => ({ default: m.ClassroomMemoryFeed })),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground space-y-3 px-1 py-4 text-sm">
        <div className="bg-muted/50 h-24 animate-pulse rounded-xl" />
        <div className="bg-muted/50 h-24 animate-pulse rounded-xl" />
      </div>
    ),
  },
);

type SupportBoardTimelineLazyProps = {
  rows: BehaviorLogRow[];
  /** Total loaded moments before memory filters (for empty states). */
  sourceRowCount: number;
};

export function SupportBoardTimelineLazy({ rows, sourceRowCount }: SupportBoardTimelineLazyProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { root: null, rootMargin: "240px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (visible) return;
    const w = typeof window !== "undefined" ? window : undefined;
    if (!w) return;
    const ric = w.requestIdleCallback?.bind(w);
    if (!ric) {
      const t = w.setTimeout(() => setVisible(true), 1800);
      return () => w.clearTimeout(t);
    }
    const id = ric(() => setVisible(true), { timeout: 4500 });
    return () => w.cancelIdleCallback?.(id);
  }, [visible]);

  return (
    <div className="space-y-3">
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      {visible ? <ClassroomMemoryFeed rows={rows} sourceRowCount={sourceRowCount} /> : null}
    </div>
  );
}
