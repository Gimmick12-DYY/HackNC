"use client";

import React from "react";
import { motion } from "framer-motion";
import { InfoData } from "./types";
import { useTheme, hexToRgba } from "./Themes";

type Props = {
  info: InfoData | null;
  width: number;
  onResize: (width: number) => void;
  onClose: () => void;
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 520;

export default function CompareSection({
  info,
  width,
  onResize,
  onClose,
}: Props) {
  const [draft, setDraft] = React.useState("");
  const lastCommittedRef = React.useRef("");
  const { theme } = useTheme();
  const sidebar = theme.ui.sidebar;

  React.useEffect(() => {
    const next = info ? info.nodes[info.rootId]?.text ?? "" : "";
    setDraft(next);
    lastCommittedRef.current = next;
  }, [info]);

  const commitDraft = React.useCallback(() => {
    if (!info?.updateText) return;
    const trimmed = draft.trim();
    const current = info.nodes[info.rootId]?.text ?? "";
    if (trimmed === current) return;
    info.updateText(trimmed);
    setDraft(trimmed);
    lastCommittedRef.current = trimmed;
  }, [draft, info]);

  const groupedRelations = React.useMemo(() => {
    if (!info) return [] as string[];
    const childrenMap: Record<string, string[]> = {};
    for (const [p, c] of info.edges) {
      if (!childrenMap[p]) childrenMap[p] = [];
      childrenMap[p].push(c);
    }

    const orderedParents = Object.keys(childrenMap);
    const rootIndex = orderedParents.indexOf(info.rootId);
    if (rootIndex > 0) {
      orderedParents.splice(rootIndex, 1);
      orderedParents.unshift(info.rootId);
    }

    const lines: string[] = [];
    for (const parent of orderedParents) {
      const kids = childrenMap[parent] || [];
      const parentOfParent = info.nodes[parent]?.parentId ?? null;
      if (parentOfParent && info.nodes[parentOfParent]) {
        lines.push(`${parentOfParent} → ${parent} → {${kids.join(", ")}}`);
      } else {
        lines.push(`${parent} → {${kids.join(", ")}}`);
      }
    }
    return lines;
  }, [info]);

  const handleResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = width;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX;
        const nextWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + delta)
        );
        onResize(nextWidth);
      };

      const handlePointerEnd = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);
    },
    [onResize, width]
  );

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
      }}
    >
      <div
        className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize"
        aria-hidden
        onPointerDown={handleResizeStart}
        style={{
          transform: "translateX(-0.75rem)",
        }}
      >
        <div className="absolute inset-y-0 right-0 w-1 rounded-full bg-slate-400/40 hover:bg-slate-500/60 transition-colors" />
      </div>
      <div className="h-full flex flex-col">
        <div
          className="p-4 border-b flex items-start justify-between gap-3"
          style={{
            borderBottomColor: sidebar.border,
            background: sidebar.headerBackground,
          }}
        >
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: sidebar.headerText }}
            >
              Info
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: sidebar.headerSubtext }}
            >
              Double-click a node to focus it, then edit its details here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm rounded-full border px-3 py-1.5 transition-colors"
            style={{
              color: sidebar.headerText,
              borderColor: sidebar.cardBorder,
              background: sidebar.cardBackground,
            }}
            aria-label="Hide info panel"
          >
            Hide
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {!info ? (
            <div className="text-sm" style={{ color: sidebar.textMuted }}>
              No selection yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="rounded-lg p-3 border"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: sidebar.textMuted }}
                >
                  Current Node
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = sidebar.inputBorder;
                    commitDraft();
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      commitDraft();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDraft(lastCommittedRef.current);
                    }
                  }}
                  disabled={!info.updateText}
                  placeholder="Refine this node's idea..."
                  className="w-full min-h-[96px] resize-none rounded-md px-3 py-2 text-sm outline-none disabled:opacity-60"
                  style={{
                    backgroundColor: sidebar.inputBackground,
                    border: `1px solid ${sidebar.inputBorder}`,
                    color: sidebar.inputText,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = sidebar.inputFocus;
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${hexToRgba(
                      sidebar.inputFocus,
                      0.2
                    )}`;
                  }}
                />
                <div
                  className="mt-2 text-[11px]"
                  style={{ color: sidebar.textMuted }}
                >
                  {info.updateText
                    ? "Press ⌘/Ctrl + Enter to save. Press Escape to revert."
                    : "This node cannot be edited."}
                </div>
                <div
                  className="mt-2 text-[11px]"
                  style={{ color: sidebar.textSecondary }}
                >
                  Node ID: {info.rootId}
                </div>
              </div>

              <div
                className="rounded-lg p-3 border"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-2"
                  style={{ color: sidebar.textMuted }}
                >
                  Subnodes
                </div>
                {(() => {
                  const directChildrenIds = info.nodes[info.rootId]?.children || [];
                  const directChildren = directChildrenIds.map((id) => info.nodes[id]).filter(Boolean);
                  return directChildren.length === 0 ? (
                    <div className="text-sm" style={{ color: sidebar.textMuted }}>
                      No subnodes.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {directChildren.map((n) => (
                        <li
                          key={n.id}
                          className="border rounded-md p-2"
                          style={{
                            borderColor: sidebar.cardBorder,
                            background: sidebar.inputBackground,
                          }}
                        >
                          <div
                            className="text-[13px] break-words"
                            style={{ color: sidebar.textPrimary }}
                          >
                            {n.text || "(empty)"}
                          </div>
                          {n.children.length > 0 && (
                            <div
                              className="mt-1 text-[12px]"
                              style={{ color: sidebar.textMuted }}
                            >
                              Children: {n.children.length}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div
                className="rounded-lg p-3 border"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-2"
                  style={{ color: sidebar.textMuted }}
                >
                  Relationships
                </div>
                {groupedRelations.length === 0 ? (
                  <div className="text-sm" style={{ color: sidebar.textMuted }}>
                    No edges.
                  </div>
                ) : (
                  <ul
                    className="space-y-1 text-[12px]"
                    style={{ color: sidebar.textSecondary }}
                  >
                    {groupedRelations.map((line, idx) => (
                      <li key={`rel-${idx}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
