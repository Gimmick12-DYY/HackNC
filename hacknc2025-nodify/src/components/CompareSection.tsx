"use client";

import React from "react";
import { motion } from "framer-motion";
import { InfoData, DebateArgument } from "./types";
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
  const isDebate = info?.mode === "debate" && Boolean(info?.debate);
  const debate = isDebate ? info!.debate! : null;
  const weightStyles: Record<DebateArgument["weight"], string> = {
    strong: "bg-emerald-100 text-emerald-700 border-emerald-300",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    weak: "bg-slate-200 text-slate-700 border-slate-300",
  };
  const weightLabels: Record<DebateArgument["weight"], string> = {
    strong: "Strong",
    medium: "Moderate",
    weak: "Exploratory",
  };

  React.useEffect(() => {
    if (info?.mode === "node" && info.rootId) {
      const next = info.nodes[info.rootId]?.text ?? "";
      setDraft(next);
      lastCommittedRef.current = next;
    } else {
      setDraft("");
      lastCommittedRef.current = "";
    }
  }, [info]);

  const commitDraft = React.useCallback(() => {
    if (!info || info.mode !== "node" || !info.updateText) return;
    if (!info.rootId) return;
    const trimmed = draft.trim();
    const current = info.nodes[info.rootId]?.text ?? "";
    if (trimmed === current) return;
    info.updateText(trimmed);
    setDraft(trimmed);
    lastCommittedRef.current = trimmed;
  }, [draft, info]);

  const groupedRelations = React.useMemo(() => {
    if (!info || info.mode !== "node" || !info.rootId) return [] as string[];
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
        height: "calc(100vh - 64px)",
        maxHeight: "calc(100vh - 64px)",
        overflow: "hidden",
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
              {isDebate ? "Debate Summary" : "Info"}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: sidebar.headerSubtext }}
            >
              {isDebate
                ? "Structured arguments generated from the selected notes."
                : "Double-click a node to focus it, then edit its details here."}
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
          ) : isDebate && debate ? (
            <div className="space-y-4">
              <div
                className="rounded-lg p-4 border"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: sidebar.textMuted }}
                >
                  Topic
                </div>
                <div
                  className="text-base font-semibold"
                  style={{ color: sidebar.textPrimary }}
                >
                  {debate.topic}
                </div>
                <p
                  className="text-sm mt-2 leading-relaxed"
                  style={{ color: sidebar.textSecondary }}
                >
                  {debate.summary}
                </p>
                <div
                  className="text-xs mt-3"
                  style={{ color: sidebar.textMuted }}
                >
                  Generated {new Date(debate.createdAt).toLocaleString()}
                </div>
              </div>

              {debate.keyInsights.length > 0 && (
                <div
                  className="rounded-lg p-4 border"
                  style={{
                    background: sidebar.cardBackground,
                    borderColor: sidebar.cardBorder,
                  }}
                >
                  <div
                    className="text-xs uppercase tracking-wide mb-2"
                    style={{ color: sidebar.textMuted }}
                  >
                    Key Insights
                  </div>
                  <ul className="space-y-1">
                    {debate.keyInsights.map((insight, index) => (
                      <li
                        key={`insight-${index}`}
                        className="text-sm leading-relaxed"
                        style={{ color: sidebar.textSecondary }}
                      >
                        • {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {debate.sides.map((side) => (
                <div
                  key={side.label}
                  className="rounded-lg p-4 border space-y-4"
                  style={{
                    background: sidebar.cardBackground,
                    borderColor: sidebar.cardBorder,
                  }}
                >
                  <div>
                    <div
                      className="text-xs uppercase tracking-wide"
                      style={{ color: sidebar.textMuted }}
                    >
                      {side.label}
                    </div>
                    <div
                      className="text-sm font-semibold mt-1"
                      style={{ color: sidebar.textPrimary }}
                    >
                      {side.stance}
                    </div>
                    <p
                      className="text-sm mt-2 leading-relaxed"
                      style={{ color: sidebar.textSecondary }}
                    >
                      {side.summary}
                    </p>
                  </div>
                  <div>
                    <div
                      className="text-xs uppercase tracking-wide mb-2"
                      style={{ color: sidebar.textMuted }}
                    >
                      Arguments
                    </div>
                    <div className="space-y-3">
                      {side.arguments.map((argument) => (
                        <div
                          key={`${argument.title}-${argument.statement}`}
                          className="rounded-md border p-3"
                          style={{
                            background: sidebar.inputBackground,
                            borderColor: sidebar.cardBorder,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div
                              className="text-sm font-medium"
                              style={{ color: sidebar.textPrimary }}
                            >
                              {argument.title}
                            </div>
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full border ${weightStyles[argument.weight]}`}
                            >
                              {weightLabels[argument.weight]}
                            </span>
                          </div>
                          <p
                            className="text-sm mt-2 leading-relaxed"
                            style={{ color: sidebar.textSecondary }}
                          >
                            {argument.statement}
                          </p>
                          <div
                            className="mt-3 text-xs uppercase tracking-wide"
                            style={{ color: sidebar.textMuted }}
                          >
                            Evidence
                          </div>
                          <p
                            className="text-sm mt-1 leading-relaxed"
                            style={{ color: sidebar.textSecondary }}
                          >
                            {argument.evidence}
                          </p>
                          <div
                            className="mt-3 text-xs uppercase tracking-wide"
                            style={{ color: sidebar.textMuted }}
                          >
                            Support
                          </div>
                          <p
                            className="text-sm mt-1 leading-relaxed"
                            style={{ color: sidebar.textSecondary }}
                          >
                            {argument.support}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {side.rebuttals.length > 0 && (
                    <div>
                      <div
                        className="text-xs uppercase tracking-wide mb-1"
                        style={{ color: sidebar.textMuted }}
                      >
                        Rebuttals to Address
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {side.rebuttals.map((rebuttal, index) => (
                          <li
                            key={`rebuttal-${side.label}-${index}`}
                            className="text-sm leading-relaxed"
                            style={{ color: sidebar.textSecondary }}
                          >
                            {rebuttal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              <div
                className="rounded-lg p-4 border space-y-3"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div>
                  <div
                    className="text-xs uppercase tracking-wide mb-1"
                    style={{ color: sidebar.textMuted }}
                  >
                    Verdict
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: sidebar.textSecondary }}
                  >
                    {debate.verdict}
                  </p>
                </div>
                {debate.recommendations.length > 0 && (
                  <div>
                    <div
                      className="text-xs uppercase tracking-wide mb-1"
                      style={{ color: sidebar.textMuted }}
                    >
                      Recommended Follow-ups
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {debate.recommendations.map((step, index) => (
                        <li
                          key={`recommendation-${index}`}
                          className="text-sm leading-relaxed"
                          style={{ color: sidebar.textSecondary }}
                        >
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {debate.sources.length > 0 && (
                <div
                  className="rounded-lg p-4 border"
                  style={{
                    background: sidebar.cardBackground,
                    borderColor: sidebar.cardBorder,
                  }}
                >
                  <div
                    className="text-xs uppercase tracking-wide mb-1"
                    style={{ color: sidebar.textMuted }}
                  >
                    Sources & References
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {debate.sources.map((source, index) => (
                      <li
                        key={`source-${index}`}
                        className="text-sm leading-relaxed"
                        style={{ color: sidebar.textSecondary }}
                      >
                        {source}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className="rounded-lg p-4 border"
                style={{
                  background: sidebar.cardBackground,
                  borderColor: sidebar.cardBorder,
                }}
              >
                <div
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: sidebar.textMuted }}
                >
                  Referenced Notes
                </div>
                <ul className="space-y-2">
                  {debate.promptNodes.map((node) => (
                    <li
                      key={node.id}
                      className="text-sm leading-relaxed"
                      style={{ color: sidebar.textSecondary }}
                    >
                      <span
                        className="font-semibold"
                        style={{ color: sidebar.textPrimary }}
                      >
                        {node.phrase ?? node.short ?? node.type}
                      </span>
                      <span className="block mt-1">{node.full}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
                  if (!info.rootId) return null;
                  const directChildrenIds =
                    info.nodes[info.rootId]?.children || [];
                  const directChildren = directChildrenIds
                    .map((id) => info.nodes[id])
                    .filter(Boolean);
                  return directChildren.length === 0 ? (
                    <div
                      className="text-sm"
                      style={{ color: sidebar.textMuted }}
                    >
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
                  <div
                    className="text-sm"
                    style={{ color: sidebar.textMuted }}
                  >
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
