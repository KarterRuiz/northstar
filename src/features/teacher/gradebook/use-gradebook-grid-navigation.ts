"use client";

import * as React from "react";

import type { ScoreDraftRow } from "./gradebook-utils";
import { parseScorePasteColumn, validateScoreDraft } from "./gradebook-utils";

export type EditableColumn = {
  /** Index among assignment-only columns (0..n-1). */
  colIndex: number;
  assignmentId: string;
  pointsPossible: number;
};

export type CellCoord = {
  rowIndex: number;
  colIndex: number;
};

export type GradebookGridNavigationValue = {
  activeCell: CellCoord | null;
  editingCell: CellCoord | null;
  editableColumns: EditableColumn[];
  selectCell: (coord: CellCoord) => void;
  startEditing: (coord?: CellCoord) => void;
  stopEditing: () => void;
  moveActive: (delta: { row?: number; col?: number }) => void;
  moveTab: (backward?: boolean) => void;
  moveAfterSave: (direction: "down" | "right" | "none") => void;
  registerCellElement: (
    coord: CellCoord,
    el: HTMLElement | null,
  ) => void;
  isCellActive: (coord: CellCoord) => boolean;
  isCellEditing: (coord: CellCoord) => boolean;
  handleGridKeyDown: (event: React.KeyboardEvent) => void;
  handleGridPaste: (event: React.ClipboardEvent) => void;
};

const GradebookGridNavigationContext =
  React.createContext<GradebookGridNavigationValue | null>(null);

export function useGradebookGridNavigation(): GradebookGridNavigationValue {
  const ctx = React.useContext(GradebookGridNavigationContext);
  if (!ctx) {
    throw new Error(
      "useGradebookGridNavigation must be used within GradebookGridNavigationProvider",
    );
  }
  return ctx;
}

export function useGradebookGridNavigationOptional(): GradebookGridNavigationValue | null {
  return React.useContext(GradebookGridNavigationContext);
}

type ProviderProps = {
  rowCount: number;
  editableColumns: EditableColumn[];
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
  onColumnPaste: (
    assignmentId: string,
    startRowIndex: number,
    drafts: ScoreDraftRow[],
  ) => void | Promise<void>;
  onPasteRejected?: (message: string) => void;
  children: React.ReactNode;
};

const STICKY_LEFT_PX = 152;
const STICKY_HEADER_PX = 44;

function scrollCellIntoView(
  container: HTMLElement,
  cell: HTMLElement,
): void {
  const cRect = container.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const minLeft = cRect.left + STICKY_LEFT_PX;
  const maxRight = cRect.right;
  const minTop = cRect.top + STICKY_HEADER_PX;
  const maxBottom = cRect.bottom;

  if (cellRect.top < minTop) {
    container.scrollTop -= minTop - cellRect.top;
  } else if (cellRect.bottom > maxBottom) {
    container.scrollTop += cellRect.bottom - maxBottom;
  }

  if (cellRect.left < minLeft) {
    container.scrollLeft -= minLeft - cellRect.left;
  } else if (cellRect.right > maxRight) {
    container.scrollLeft += cellRect.right - maxRight;
  }
}

export function GradebookGridNavigationProvider({
  rowCount,
  editableColumns,
  scrollContainerRef,
  disabled,
  onColumnPaste,
  onPasteRejected,
  children,
}: ProviderProps) {
  const [activeCell, setActiveCell] = React.useState<CellCoord | null>(null);
  const [editingCell, setEditingCell] = React.useState<CellCoord | null>(null);
  const cellElementsRef = React.useRef<Map<string, HTMLElement>>(new Map());

  const colCount = editableColumns.length;

  const cellKey = (coord: CellCoord) => `${coord.rowIndex}:${coord.colIndex}`;

  const clampCoord = React.useCallback(
    (coord: CellCoord): CellCoord | null => {
      if (rowCount === 0 || colCount === 0) return null;
      const rowIndex = Math.max(0, Math.min(rowCount - 1, coord.rowIndex));
      const colIndex = Math.max(0, Math.min(colCount - 1, coord.colIndex));
      return { rowIndex, colIndex };
    },
    [rowCount, colCount],
  );

  const scrollToCell = React.useCallback(
    (coord: CellCoord) => {
      const container = scrollContainerRef?.current;
      const el = cellElementsRef.current.get(cellKey(coord));
      if (container && el) scrollCellIntoView(container, el);
    },
    [scrollContainerRef],
  );

  const selectCell = React.useCallback(
    (coord: CellCoord) => {
      if (disabled) return;
      const next = clampCoord(coord);
      if (!next) return;
      setEditingCell(null);
      setActiveCell(next);
      scrollContainerRef?.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => scrollToCell(next));
    },
    [clampCoord, disabled, scrollContainerRef, scrollToCell],
  );

  const stopEditing = React.useCallback(() => {
    setEditingCell(null);
  }, []);

  const startEditing = React.useCallback(
    (coord?: CellCoord) => {
      if (disabled) return;
      const target = clampCoord(coord ?? activeCell ?? { rowIndex: 0, colIndex: 0 });
      if (!target) return;
      setActiveCell(target);
      setEditingCell(target);
      requestAnimationFrame(() => scrollToCell(target));
    },
    [activeCell, clampCoord, disabled, scrollToCell],
  );

  const moveActive = React.useCallback(
    (delta: { row?: number; col?: number }) => {
      if (disabled || editingCell) return;
      const base = activeCell ?? { rowIndex: 0, colIndex: 0 };
      const next = clampCoord({
        rowIndex: base.rowIndex + (delta.row ?? 0),
        colIndex: base.colIndex + (delta.col ?? 0),
      });
      if (!next) return;
      setActiveCell(next);
      requestAnimationFrame(() => scrollToCell(next));
    },
    [activeCell, clampCoord, disabled, editingCell, scrollToCell],
  );

  const moveTab = React.useCallback(
    (backward?: boolean) => {
      if (disabled || editingCell) return;
      const base = activeCell ?? { rowIndex: 0, colIndex: 0 };
      let { rowIndex, colIndex } = base;
      if (backward) {
        colIndex -= 1;
        if (colIndex < 0) {
          colIndex = colCount - 1;
          rowIndex -= 1;
        }
      } else {
        colIndex += 1;
        if (colIndex >= colCount) {
          colIndex = 0;
          rowIndex += 1;
        }
      }
      const next = clampCoord({ rowIndex, colIndex });
      if (!next) return;
      setActiveCell(next);
      requestAnimationFrame(() => scrollToCell(next));
    },
    [activeCell, clampCoord, colCount, disabled, editingCell, scrollToCell],
  );

  const moveAfterSave = React.useCallback(
    (direction: "down" | "right" | "none") => {
      setEditingCell(null);
      if (direction === "none" || !activeCell) return;
      if (direction === "down") {
        moveActive({ row: 1 });
      } else {
        moveTab(false);
      }
    },
    [activeCell, moveActive, moveTab],
  );

  const registerCellElement = React.useCallback(
    (coord: CellCoord, el: HTMLElement | null) => {
      const key = cellKey(coord);
      if (el) cellElementsRef.current.set(key, el);
      else cellElementsRef.current.delete(key);
    },
    [],
  );

  const isCellActive = React.useCallback(
    (coord: CellCoord) =>
      activeCell?.rowIndex === coord.rowIndex &&
      activeCell.colIndex === coord.colIndex,
    [activeCell],
  );

  const isCellEditing = React.useCallback(
    (coord: CellCoord) =>
      editingCell?.rowIndex === coord.rowIndex &&
      editingCell.colIndex === coord.colIndex,
    [editingCell],
  );

  const handleGridKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (editingCell) return;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          if (!activeCell) selectCell({ rowIndex: 0, colIndex: 0 });
          else moveActive({ row: -1 });
          break;
        case "ArrowDown":
          event.preventDefault();
          if (!activeCell) selectCell({ rowIndex: 0, colIndex: 0 });
          else moveActive({ row: 1 });
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (!activeCell) selectCell({ rowIndex: 0, colIndex: 0 });
          else moveActive({ col: -1 });
          break;
        case "ArrowRight":
          event.preventDefault();
          if (!activeCell) selectCell({ rowIndex: 0, colIndex: 0 });
          else moveActive({ col: 1 });
          break;
        case "Tab":
          event.preventDefault();
          if (!activeCell) selectCell({ rowIndex: 0, colIndex: 0 });
          else moveTab(event.shiftKey);
          break;
        case "Enter":
          event.preventDefault();
          startEditing();
          break;
        case "Escape":
          break;
        default:
          break;
      }
    },
    [
      activeCell,
      disabled,
      editingCell,
      moveActive,
      moveTab,
      selectCell,
      startEditing,
    ],
  );

  const handleGridPaste = React.useCallback(
    (event: React.ClipboardEvent) => {
      if (disabled || !activeCell) return;
      const column = editableColumns[activeCell.colIndex];
      if (!column) return;

      const text = event.clipboardData.getData("text/plain");
      if (!text.trim()) return;

      const parsed = parseScorePasteColumn(text);
      if (parsed === "invalid") {
        onPasteRejected?.(
          "Could not paste: use numbers, blank, M (missing), or A (absent).",
        );
        return;
      }

      for (const draft of parsed) {
        const err = validateScoreDraft(draft, column.pointsPossible);
        if (err) {
          onPasteRejected?.(err);
          return;
        }
      }

      event.preventDefault();
      void onColumnPaste(column.assignmentId, activeCell.rowIndex, parsed);
    },
    [activeCell, disabled, editableColumns, onColumnPaste, onPasteRejected],
  );

  const value = React.useMemo(
    (): GradebookGridNavigationValue => ({
      activeCell,
      editingCell,
      editableColumns,
      selectCell,
      startEditing,
      stopEditing,
      moveActive,
      moveTab,
      moveAfterSave,
      registerCellElement,
      isCellActive,
      isCellEditing,
      handleGridKeyDown,
      handleGridPaste,
    }),
    [
      activeCell,
      editingCell,
      editableColumns,
      selectCell,
      startEditing,
      stopEditing,
      moveActive,
      moveTab,
      moveAfterSave,
      registerCellElement,
      isCellActive,
      isCellEditing,
      handleGridKeyDown,
      handleGridPaste,
    ],
  );

  return React.createElement(
    GradebookGridNavigationContext.Provider,
    { value },
    children,
  );
}
