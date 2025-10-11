"use client";

import React from "react";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { useTheme } from "./Themes";

type Props = {
  width: number;
  onResize: (width: number) => void;
  onClose: () => void;
  items: NodeItem[];
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 520;

export default function CollectorPanel({ width, onResize, onClose, items, selectionMode, onToggleSelectionMode }: Props) {
  const { theme } = useTheme();
  const sidebar = theme.ui.sidebar;

  const handleResizeStart = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const handleMove = (e: PointerEvent) => {
      const delta = startX - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      onResize(next);
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  }, [onResize, width]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0, width }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="shadow-lg h-full flex flex-col border-l relative"
      style={{
        width,
        background: sidebar.background,
        borderLeftColor: sidebar.border,
        height: "calc(100vh - 64px)",
        maxHeight: "calc(100vh - 64px)",
        overflow: "hidden",
      }}
    >
      <div
        className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize"
        aria-hidden
        onPointerDown={handleResizeStart}
        style={{ transform: "translateX(-0.75rem)" }}
      >
        <div className="absolute inset-y-0 right-0 w-1 rounded-full bg-slate-400/40 hover:bg-slate-500/60 transition-colors" />
      </div>

      <div className="p-4 border-b flex items-start justify-between gap-3" style={{ borderBottomColor: sidebar.border, background: sidebar.headerBackground }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: sidebar.headerText }}>Collector</h2>
          <p className="text-sm mt-1" style={{ color: sidebar.headerSubtext }}>
            Select nodes to collect them here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onToggleSelectionMode} className="text-sm rounded-full border px-3 py-1.5 transition-colors"
            style={{ color: sidebar.headerText, borderColor: sidebar.cardBorder, background: selectionMode ? sidebar.inputBackground : sidebar.cardBackground }}>
            {selectionMode ? "Selecting…" : "Select nodes"}
          </button>
          <button type="button" onClick={onClose} className="text-sm rounded-full border px-3 py-1.5 transition-colors"
            style={{ color: sidebar.headerText, borderColor: sidebar.cardBorder, background: sidebar.cardBackground }}>Hide</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm" style={{ color: sidebar.textMuted }}>No nodes collected yet.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }}>
                <div className="text-[13px] break-words" style={{ color: sidebar.textPrimary }}>
                  {n.text || n.full || n.phrase || n.short || n.type}
                </div>
                {n.children?.length ? (
                  <div className="mt-1 text-[12px]" style={{ color: sidebar.textMuted }}>Children: {n.children.length}</div>
                ) : null}
                <div className="text-[11px] mt-1" style={{ color: sidebar.textSecondary }}>ID: {n.id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}


