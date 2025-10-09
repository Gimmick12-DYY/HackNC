"use client";

import React from "react";
import { motion } from "framer-motion";
import { InfoData } from "./types";

type Props = {
  info: InfoData | null;
};

export default function CompareSection({ info }: Props) {
  const [draft, setDraft] = React.useState("");
  const lastCommittedRef = React.useRef("");

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
      className="w-80 bg-[#fffaf3] shadow-lg border-l border-[#e6dccb] h-full flex flex-col"
    >
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-[#e6dccb] bg-gradient-to-r from-[#f7f2e8] to-[#f3eadb]">
          <h2 className="text-lg font-semibold text-[#171717]">Info</h2>
          <p className="text-sm text-[#6b7280] mt-1">
            Double-click a node to focus it, then edit its details here.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {!info ? (
            <div className="text-sm text-[#6b7280]">No selection yet.</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-[#e5e7eb] rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-[#6b7280] mb-1">
                  Current Node
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
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
                  className="w-full min-h-[96px] resize-none rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/30 disabled:opacity-60"
                />
                <div className="mt-2 text-[11px] text-[#6b7280]">
                  {info.updateText
                    ? "Press ⌘/Ctrl + Enter to save. Press Escape to revert."
                    : "This node cannot be edited."}
                </div>
                <div className="mt-2 text-[11px] text-[#94a3b8]">
                  Node ID: {info.rootId}
                </div>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-[#6b7280] mb-2">
                  Subnodes
                </div>
                {(() => {
                  const directChildrenIds = info.nodes[info.rootId]?.children || [];
                  const directChildren = directChildrenIds.map((id) => info.nodes[id]).filter(Boolean);
                  return directChildren.length === 0 ? (
                    <div className="text-sm text-[#6b7280]">No subnodes.</div>
                  ) : (
                    <ul className="space-y-2">
                      {directChildren.map((n) => (
                        <li
                          key={n.id}
                          className="border border-[#e5e7eb] rounded-md p-2 bg-[#f9fafb]"
                        >
                          <div className="text-[13px] text-[#111827] break-words">
                            {n.text || "(empty)"}
                          </div>
                          {n.children.length > 0 && (
                            <div className="mt-1 text-[12px] text-[#6b7280]">
                              Children: {n.children.length}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-lg p-3">
                <div className="text-xs uppercase tracking-wide text-[#6b7280] mb-2">
                  Relationships
                </div>
                {groupedRelations.length === 0 ? (
                  <div className="text-sm text-[#6b7280]">No edges.</div>
                ) : (
                  <ul className="space-y-1 text-[12px] text-[#374151]">
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
