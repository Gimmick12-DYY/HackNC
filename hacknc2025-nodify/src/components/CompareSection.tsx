"use client";

import React from "react";
import { motion } from "framer-motion";
import { InfoData } from "./types";
import { useTheme, hexToRgba } from "./Themes";

type Props = {
  info: InfoData | null;
};

export default function CompareSection({ info }: Props) {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-80 shadow-lg h-full flex flex-col border-l"
      style={{
        background: sidebar.background,
        borderLeftColor: sidebar.border,
      }}
    >
      <div className="h-full flex flex-col">
        <div
          className="p-4 border-b"
          style={{
            borderBottomColor: sidebar.border,
            background: sidebar.headerBackground,
          }}
        >
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
