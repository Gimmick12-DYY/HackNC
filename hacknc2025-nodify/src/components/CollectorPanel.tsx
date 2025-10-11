"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  NodeItem,
  CollectorState,
  CollectorMode,
  ThoughtEntry,
  DebateRecord,
  DebateRequestNode,
} from "./types";
import { useTheme, hexToRgba } from "./Themes";
import { debateNodes } from "./debate";

type Props = {
  width: number;
  onResize: (width: number) => void;
  onClose: () => void;
  state: CollectorState;
  onChangeState: (next: CollectorState) => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  outputs: ThoughtEntry[];
  activeOutputId: string | null;
  onRecordOutput: (entry: ThoughtEntry) => void;
  onSelectOutput: (id: string) => void;
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 520;

type DragListKey =
  | "pool"
  | "argument-evidences"
  | "counter-evidences"
  | "script-outline"
  | "debate-participants";
type DragSourceKey = DragListKey | "argument-main" | "counter-main";

const DRAG_LIST_KEYS: readonly DragListKey[] = [
  "pool",
  "argument-evidences",
  "counter-evidences",
  "script-outline",
  "debate-participants",
] as const;

type DropIndicator =
  | { kind: "list"; list: DragListKey; index: number }
  | { kind: "main"; section: "argument" | "counter" }
  | { kind: "trash" }
  | null;

type ActiveDragState = {
  node: NodeItem;
  source: DragSourceKey;
  index: number | null;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  clientX: number;
  clientY: number;
};

const getNodeLabel = (node: NodeItem) =>
  node.text || node.full || node.short || node.id;

const isListKey = (key: DragSourceKey): key is DragListKey =>
  DRAG_LIST_KEYS.includes(key as DragListKey);

const createEntryId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `thought-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type DebateOutputCardProps = {
  debate: DebateRecord;
  textColor: string;
  mutedColor: string;
  borderColor: string;
};

const DebateOutputCard: React.FC<DebateOutputCardProps> = ({ debate, textColor, mutedColor, borderColor }) => (
  <div className="space-y-3 text-[13px]" style={{ color: textColor }}>
    <section>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: mutedColor }}>
        Summary
      </div>
      <p className="leading-relaxed">{debate.summary}</p>
    </section>
    {debate.keyInsights.length > 0 && (
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: mutedColor }}>
          Key insights
        </div>
        <ul className="space-y-1 list-disc list-inside">
          {debate.keyInsights.map((insight, index) => (
            <li key={`${debate.id}-insight-${index}`} className="leading-snug">
              {insight}
            </li>
          ))}
        </ul>
      </section>
    )}
    {debate.sides.length > 0 && (
      <section className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: mutedColor }}>
          Perspectives
        </div>
        {debate.sides.map((side) => (
          <div key={`${debate.id}-${side.label}`} className="border rounded-md px-2 py-1.5 space-y-1" style={{ borderColor }}>
            <div className="text-[12px] font-semibold">{side.label}: {side.stance}</div>
            <div className="text-[12px] leading-snug">{side.summary}</div>
          </div>
        ))}
      </section>
    )}
    <section>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: mutedColor }}>
        Verdict
      </div>
      <p className="leading-snug">{debate.verdict}</p>
    </section>
    {debate.recommendations.length > 0 && (
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: mutedColor }}>
          Recommendations
        </div>
        <ul className="space-y-1 list-disc list-inside">
          {debate.recommendations.map((rec, index) => (
            <li key={`${debate.id}-rec-${index}`} className="leading-snug">
              {rec}
            </li>
          ))}
        </ul>
      </section>
    )}
    {debate.sources.length > 0 && (
      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: mutedColor }}>
          Sources
        </div>
        <ul className="space-y-1 list-disc list-inside">
          {debate.sources.map((source, index) => (
            <li key={`${debate.id}-source-${index}`} className="leading-snug break-words">
              {source}
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export default function CollectorPanel({
  width,
  onResize,
  onClose,
  state,
  onChangeState,
  selectionMode,
  onToggleSelectionMode,
  outputs,
  activeOutputId,
  onRecordOutput,
  onSelectOutput,
}: Props) {
  const { theme } = useTheme();
  const sidebar = theme.ui.sidebar;
  const accent = sidebar.inputFocus;
  const accentBg = hexToRgba(accent, 0.12);
  const accentBgHover = hexToRgba(accent, 0.2);
  const dropAccent = hexToRgba(accent, 0.45);

  const createDraft = React.useCallback((): CollectorState => ({
    argument: {
      main: state.argument.main,
      evidences: [...state.argument.evidences],
    },
    counter: {
      main: state.counter.main,
      evidences: [...state.counter.evidences],
    },
    script: {
      outline: [...state.script.outline],
    },
    debate: {
      participants: [...state.debate.participants],
    },
    target: { ...state.target },
    pool: [...state.pool],
  }), [state]);

  const mutateState = React.useCallback((producer: (draft: CollectorState) => void) => {
    const draft = createDraft();
    producer(draft);
    onChangeState(draft);
  }, [createDraft, onChangeState]);

  const getList = React.useCallback((draft: CollectorState, key: DragListKey): NodeItem[] => {
    switch (key) {
      case "pool":
        return draft.pool;
      case "argument-evidences":
        return draft.argument.evidences;
      case "counter-evidences":
        return draft.counter.evidences;
      case "script-outline":
        return draft.script.outline;
      case "debate-participants":
        return draft.debate.participants;
      default:
        return draft.pool;
    }
  }, []);

  const detachNode = React.useCallback((draft: CollectorState, id: string) => {
    draft.pool = draft.pool.filter((x) => x.id !== id);
    draft.argument.evidences = draft.argument.evidences.filter((x) => x.id !== id);
    draft.counter.evidences = draft.counter.evidences.filter((x) => x.id !== id);
    draft.script.outline = draft.script.outline.filter((x) => x.id !== id);
    draft.debate.participants = draft.debate.participants.filter((x) => x.id !== id);
    if (draft.argument.main?.id === id) draft.argument.main = null;
    if (draft.counter.main?.id === id) draft.counter.main = null;
  }, []);

  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState | null>(null);
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator>(null);
  const [generatingMode, setGeneratingMode] = React.useState<CollectorMode | null>(null);

  const dragDataRef = React.useRef<{ node: NodeItem; source: DragSourceKey; index: number | null } | null>(null);
  const pointerListenersRef = React.useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);
  const previousUserSelectRef = React.useRef<string | null>(null);
  const previousCursorRef = React.useRef<string | null>(null);
  const activeDragRef = React.useRef<ActiveDragState | null>(null);
  const dropIndicatorRef = React.useRef<DropIndicator>(null);
  const listRefs = React.useRef<Record<DragListKey, HTMLDivElement | null>>({
    "pool": null,
    "argument-evidences": null,
    "counter-evidences": null,
    "script-outline": null,
    "debate-participants": null,
  });
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const mainRefs = React.useRef<{ argument: HTMLDivElement | null; counter: HTMLDivElement | null }>({
    argument: null,
    counter: null,
  });

  React.useEffect(() => { activeDragRef.current = activeDrag; }, [activeDrag]);
  React.useEffect(() => { dropIndicatorRef.current = dropIndicator; }, [dropIndicator]);
  React.useEffect(() => {
    dropIndicatorRef.current = null;
    setDropIndicator(null);
  }, [state.target.section]);

  const buildNodeList = React.useCallback((items: NodeItem[]): string => {
    return items.map((n, index) => `${index + 1}. ${getNodeLabel(n)}`).join("\n");
  }, []);

  const requestGeneration = React.useCallback(async (prompt: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          count: 1,
          phraseLength: 12,
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        throw new Error(`Generation failed (${res.status})`);
      }
      const data = await res.json();
      const text =
        Array.isArray(data.items) && data.items[0]
          ? data.items[0].full || data.items[0].text || String(data.items[0])
          : "";
      const result = String(text || "").trim();
      if (!result) {
        throw new Error("No response generated");
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate content";
      alert(message);
      return null;
    }
  }, []);

  const resolveNodeById = React.useCallback(
    (id: string): NodeItem | null => {
      if (state.argument.main?.id === id) return state.argument.main;
      if (state.counter.main?.id === id) return state.counter.main;
      const pools: NodeItem[][] = [
        state.pool,
        state.argument.evidences,
        state.counter.evidences,
        state.script.outline,
        state.debate.participants,
      ];
      for (const list of pools) {
        const match = list.find((node) => node.id === id);
        if (match) return match;
      }
      return null;
    },
    [state]
  );

  const sendToPool = React.useCallback(
    (id: string) => {
      const node = resolveNodeById(id);
      if (!node) return;
      mutateState((draft) => {
        detachNode(draft, id);
        if (!draft.pool.find((n) => n.id === id)) {
          draft.pool.unshift({ ...node });
        }
      });
    },
    [detachNode, mutateState, resolveNodeById]
  );

  const emitOutput = React.useCallback(
    (mode: CollectorMode, payload: { title: string; content?: string; debate?: DebateRecord }) => {
      const entry: ThoughtEntry = {
        id: createEntryId(),
        mode,
        createdAt: Date.now(),
        title: payload.title,
        content: payload.content,
        debate: payload.debate,
      };
      onRecordOutput(entry);
      onSelectOutput(entry.id);
    },
    [onRecordOutput, onSelectOutput]
  );

  const ensureFieldForSection = React.useCallback(
    (section: CollectorMode, field: CollectorState["target"]["field"]): CollectorState["target"]["field"] => {
      switch (section) {
        case "argument":
          return field === "main" || field === "evidence" ? field : "evidence";
        case "counter":
          return "main";
        case "script":
          return "outline";
        case "debate":
          return "participants";
        default:
          return field;
      }
    },
    []
  );

  const handleSelectSection = React.useCallback(
    (section: CollectorMode) => {
      onChangeState({
        ...state,
        target: {
          section,
          field: ensureFieldForSection(section, state.target.section === section ? state.target.field : "main"),
        },
      });
    },
    [ensureFieldForSection, onChangeState, state]
  );

  const modeLabels: Record<CollectorMode, string> = {
    argument: "Argument",
    counter: "Anti-Argument",
    script: "Script",
    debate: "Debate",
  };
  const modeOrder: CollectorMode[] = ["argument", "counter", "script", "debate"];

  const modeOutputs = React.useMemo(
    () => outputs.filter((entry) => entry.mode === state.target.section),
    [outputs, state.target.section]
  );

  const handleGenerateArgument = React.useCallback(async () => {
    if (generatingMode) return;
    const main = state.argument.main;
    if (!main) {
      alert("Set an argument main point before generating.");
      return;
    }
    const evidences = state.argument.evidences;
    const prompt = [
      "You are an assistant helping prepare a persuasive argument.",
      `Main claim: ${getNodeLabel(main)}`,
      "",
      evidences.length > 0
        ? `Supporting evidence:\n${buildNodeList(evidences)}`
        : "Supporting evidence: none provided. Invent 3 credible, distinct evidences that strongly support the claim.",
      "",
      "Write an articulate persuasive explanation (around 200 words) backing the claim and list the supporting evidences afterwards as bullet points."
    ].join("\n");
    setGeneratingMode("argument");
    try {
      const text = await requestGeneration(prompt);
      if (text) {
        emitOutput("argument", {
          title: `Argument • ${getNodeLabel(main)}`,
          content: text,
        });
      }
    } finally {
      setGeneratingMode(null);
    }
  }, [buildNodeList, emitOutput, generatingMode, requestGeneration, state.argument]);

  const handleGenerateCounter = React.useCallback(async () => {
    if (generatingMode) return;
    const main = state.counter.main;
    if (!main) {
      alert("Set an anti-argument main point before generating.");
      return;
    }
    const existing = state.counter.evidences;
    const prompt = [
      "Craft a compelling counter-argument to the following statement.",
      `Target statement: ${getNodeLabel(main)}`,
      "",
      existing.length > 0
        ? `Existing counter-evidences:\n${buildNodeList(existing)}`
        : "No counter-evidences were supplied. Invent several credible evidences that undermine the target statement.",
      "",
      "Produce a compelling counter-argument (around 200 words) followed by bullet points listing the evidences you rely on."
    ].join("\n");
    setGeneratingMode("counter");
    try {
      const text = await requestGeneration(prompt);
      if (text) {
        emitOutput("counter", {
          title: `Counterpoint • ${getNodeLabel(main)}`,
          content: text,
        });
      }
    } finally {
      setGeneratingMode(null);
    }
  }, [buildNodeList, emitOutput, generatingMode, requestGeneration, state.counter]);

  const handleGenerateScript = React.useCallback(async () => {
    if (generatingMode) return;
    const outline = state.script.outline;
    if (outline.length === 0) {
      alert("Select nodes for the script outline before generating.");
      return;
    }
    const prompt = [
      "Write a descriptive, engaging narrative that follows the ordered outline points below.",
      buildNodeList(outline),
      "",
      "Produce 2-3 flowing paragraphs (around 220 words) that clearly reference each outline point."
    ].join("\n");
    setGeneratingMode("script");
    try {
      const text = await requestGeneration(prompt);
      if (text) {
        emitOutput("script", {
          title: "Script",
          content: text,
        });
      }
    } finally {
      setGeneratingMode(null);
    }
  }, [buildNodeList, emitOutput, generatingMode, requestGeneration, state.script.outline]);

  const handleGenerateDebate = React.useCallback(async () => {
    if (generatingMode) return;
    const participants = state.debate.participants;
    if (participants.length < 2) {
      alert("Pick at least two participants before running a debate.");
      return;
    }
    const inputs: DebateRequestNode[] = [];
    const missing: string[] = [];
    participants.forEach((node) => {
      const full = (node.full ?? node.text ?? node.phrase ?? node.short ?? "").trim();
      if (!full) {
        missing.push(node.id);
        return;
      }
      inputs.push({
        id: node.id,
        type: node.type ?? "idea",
        full,
        phrase: node.phrase?.trim() || undefined,
        short: node.short?.trim() || undefined,
      });
    });
    if (missing.length) {
      alert("Some participants do not have enough content to debate.");
      return;
    }
    setGeneratingMode("debate");
    try {
      const debate = await debateNodes(inputs, {});
      emitOutput("debate", {
        title: debate.topic || "Debate",
        debate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate debate";
      alert(message);
    } finally {
      setGeneratingMode(null);
    }
  }, [emitOutput, generatingMode, state.debate.participants]);

  const renderGenerateButton = (mode: CollectorMode) => {
    const handler =
      mode === "argument"
        ? handleGenerateArgument
        : mode === "counter"
          ? handleGenerateCounter
          : mode === "script"
            ? handleGenerateScript
            : handleGenerateDebate;
    const busy = generatingMode === mode;
    return (
      <button
        type="button"
        onClick={handler}
        disabled={busy}
        className="flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 shadow-sm transition-colors"
        style={{
          color: sidebar.textPrimary,
          borderColor: accent,
          background: busy ? accentBgHover : accentBg,
          opacity: busy ? 0.75 : 1,
          cursor: busy ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = accentBgHover;
          (e.currentTarget as HTMLButtonElement).style.borderColor = accent;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = accentBg;
          (e.currentTarget as HTMLButtonElement).style.borderColor = accent;
        }}
      >
        {busy ? (
          <svg
            className="w-4 h-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
        )}
        <span>{busy ? "Generating..." : "Generate"}</span>
      </button>
    );
  };

  const disableTextSelection = React.useCallback(() => {
    if (typeof document === "undefined") return;
    previousUserSelectRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
  }, []);

  const restoreTextSelection = React.useCallback(() => {
    if (typeof document === "undefined") return;
    if (previousUserSelectRef.current != null) {
      document.body.style.userSelect = previousUserSelectRef.current;
      previousUserSelectRef.current = null;
    } else {
      document.body.style.userSelect = "";
    }
  }, []);

  const cleanupPointerListeners = React.useCallback(() => {
    const listeners = pointerListenersRef.current;
    if (listeners) {
      window.removeEventListener("pointermove", listeners.move);
      window.removeEventListener("pointerup", listeners.up);
      window.removeEventListener("pointercancel", listeners.cancel);
      pointerListenersRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      cleanupPointerListeners();
      if (typeof document !== "undefined") {
        if (previousUserSelectRef.current != null) {
          document.body.style.userSelect = previousUserSelectRef.current;
          previousUserSelectRef.current = null;
        } else {
          document.body.style.userSelect = "";
        }
        if (previousCursorRef.current != null) {
          document.body.style.cursor = previousCursorRef.current;
          previousCursorRef.current = null;
        } else {
          document.body.style.cursor = "";
        }
      }
    };
  }, [cleanupPointerListeners]);

  const setActiveDragState = React.useCallback((value: ActiveDragState | null | ((prev: ActiveDragState | null) => ActiveDragState | null)) => {
    setActiveDrag((prev) => {
      const next = typeof value === "function" ? (value as (p: ActiveDragState | null) => ActiveDragState | null)(prev) : value;
      activeDragRef.current = next;
      return next;
    });
  }, []);

  const updateDropTarget = React.useCallback((clientX: number, clientY: number) => {
    const margin = 18;
    const applyDropIndicator = (next: DropIndicator) => {
      const current = dropIndicatorRef.current;
      if (current && next) {
        if (
          current.kind === "main" &&
          next.kind === "main" &&
          current.section === next.section
        ) {
          return;
        }
        if (
          current.kind === "list" &&
          next.kind === "list" &&
          current.list === next.list &&
          current.index === next.index
        ) {
          return;
        }
      }
      if (!current && next === null) {
        return;
      }
      dropIndicatorRef.current = next;
      setDropIndicator(next);
    };

    const argumentMain = mainRefs.current.argument;
    if (argumentMain) {
      const rect = argumentMain.getBoundingClientRect();
      if (
        clientX >= rect.left - margin &&
        clientX <= rect.right + margin &&
        clientY >= rect.top - margin &&
        clientY <= rect.bottom + margin
      ) {
        applyDropIndicator({ kind: "main", section: "argument" });
        return;
      }
    }
    const counterMain = mainRefs.current.counter;
    if (counterMain) {
      const rect = counterMain.getBoundingClientRect();
      if (
        clientX >= rect.left - margin &&
        clientX <= rect.right + margin &&
        clientY >= rect.top - margin &&
        clientY <= rect.bottom + margin
      ) {
        applyDropIndicator({ kind: "main", section: "counter" });
        return;
      }
    }

    for (const list of DRAG_LIST_KEYS) {
      const container = listRefs.current[list];
      if (!container) continue;
      const rect = container.getBoundingClientRect();
      if (
        clientX >= rect.left - margin &&
        clientX <= rect.right + margin &&
        clientY >= rect.top - margin &&
        clientY <= rect.bottom + margin
      ) {
        const chips = Array.from(container.querySelectorAll<HTMLElement>("[data-node-id]"));
        if (chips.length === 0) {
          applyDropIndicator({ kind: "list", list, index: 0 });
          return;
        }
        for (let i = 0; i < chips.length; i += 1) {
          const chipRect = chips[i].getBoundingClientRect();
          if (clientY < chipRect.top + chipRect.height / 2) {
            applyDropIndicator({ kind: "list", list, index: i });
            return;
          }
        }
        applyDropIndicator({ kind: "list", list, index: chips.length });
        return;
      }
    }

    // If pointer is outside of the collector panel entirely, show trash overlay
    const panel = panelRef.current;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) {
        applyDropIndicator({ kind: "trash" });
        return;
      }
    }
    applyDropIndicator(null);
  }, []);

  const finishDrag = React.useCallback((commit: boolean) => {
    restoreTextSelection();
    if (typeof document !== "undefined") {
      if (previousCursorRef.current != null) {
        document.body.style.cursor = previousCursorRef.current;
        previousCursorRef.current = null;
      } else {
        document.body.style.cursor = "";
      }
    }
    cleanupPointerListeners();
    const dropTarget = dropIndicatorRef.current;
    const dragData = dragDataRef.current;
    dragDataRef.current = null;
    setActiveDragState(null);
    setDropIndicator(null);

    if (!commit || !dropTarget || !dragData) {
      return;
    }

    if (dropTarget.kind === "list") {
      const originalList = isListKey(dragData.source) ? dragData.source : null;
      const originalIndex = dragData.index;
      let insertAt = dropTarget.index;
      if (originalList === dropTarget.list && originalIndex != null) {
        if (insertAt > originalIndex) insertAt -= 1;
        if (insertAt === originalIndex) {
          return;
        }
      }
      mutateState((draft) => {
        detachNode(draft, dragData.node.id);
        const target = getList(draft, dropTarget.list);
        const clamped = Math.max(0, Math.min(insertAt, target.length));
        target.splice(clamped, 0, dragData.node);
      });
      return;
    }

    if (dropTarget.kind === "main") {
      if (
        (dropTarget.section === "argument" && dragData.source === "argument-main") ||
        (dropTarget.section === "counter" && dragData.source === "counter-main")
      ) {
        return;
      }
      mutateState((draft) => {
        // remove incoming from any previous location
        detachNode(draft, dragData.node.id);
        if (dropTarget.section === "argument") {
          const prev = draft.argument.main;
          draft.argument.main = dragData.node;
          // return previous main to pool if it exists and isn't the same as incoming
          if (prev && prev.id !== dragData.node.id && !draft.pool.find((x) => x.id === prev.id)) {
            draft.pool.push(prev);
          }
        } else {
          const prev = draft.counter.main;
          draft.counter.main = dragData.node;
          if (prev && prev.id !== dragData.node.id && !draft.pool.find((x) => x.id === prev.id)) {
            draft.pool.push(prev);
          }
        }
      });
    }
    if (dropTarget.kind === "trash") {
      mutateState((draft) => {
        detachNode(draft, dragData.node.id);
        // do not add to pool; it's a delete
      });
      return;
    }
  }, [cleanupPointerListeners, detachNode, getList, mutateState, restoreTextSelection, setActiveDragState]);

  const beginDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>, node: NodeItem, source: DragSourceKey, index?: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    disableTextSelection();
    if (typeof document !== "undefined") {
      previousCursorRef.current = document.body.style.cursor;
      document.body.style.cursor = "grabbing";
    }
    dragDataRef.current = { node, source, index: index ?? null };
    setActiveDragState({
      node,
      source,
      index: index ?? null,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    updateDropTarget(event.clientX, event.clientY);

    const handleMove = (e: PointerEvent) => {
      setActiveDragState((prev) =>
        prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev
      );
      updateDropTarget(e.clientX, e.clientY);
    };
    const handleUp = () => {
      const hasTarget = dropIndicatorRef.current != null;
      finishDrag(Boolean(hasTarget));
    };
    const handleCancel = () => {
      finishDrag(false);
    };
    pointerListenersRef.current = { move: handleMove, up: handleUp, cancel: handleCancel };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  }, [disableTextSelection, finishDrag, setActiveDragState, updateDropTarget]);

  const DraggableChip: React.FC<{
    node: NodeItem;
    source: DragSourceKey;
    index?: number;
    onReturnToPool?: () => void;
  }> = ({ node, source, index, onReturnToPool }) => {
    const isActive = activeDrag?.node.id === node.id;
    return (
      <div
        data-node-id={node.id}
        onPointerDown={(e) => beginDrag(e, node, source, index)}
        className={`rounded-md px-2 py-1 border text-[12px] select-none ${isActive ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          borderColor: sidebar.cardBorder,
          background: sidebar.inputBackground,
          color: sidebar.textPrimary,
          opacity: isActive ? 0.2 : 1,
          visibility: isActive ? "hidden" : "visible",
          pointerEvents: isActive ? "none" : "auto",
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onReturnToPool?.();
        }}
        >
        {getNodeLabel(node)}
      </div>
    );
  };

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
    <>
      <motion.div
        ref={panelRef}
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
      {dropIndicator?.kind === 'trash' && createPortal(
        <div className="fixed inset-0 z-[90]" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full w-24 h-24 flex items-center justify-center shadow-xl" style={{ background: hexToRgba(accent, 0.2), border: `2px solid ${accent}` }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
          </div>
        </div>, document.body
      )}
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
          <button
            type="button"
            onClick={onToggleSelectionMode}
            className="text-sm rounded-full border px-3 py-1.5 transition-colors shadow-sm flex items-center gap-2"
            style={{ color: sidebar.headerText, borderColor: selectionMode ? accent : sidebar.cardBorder, background: selectionMode ? accentBg : sidebar.cardBackground }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = selectionMode ? accentBgHover : accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = selectionMode ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = selectionMode ? accent : sidebar.cardBorder; }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"
              />
            </svg>
            <span>{selectionMode ? "Selecting…" : "Select nodes"}</span>
          </button>
          <button type="button" onClick={onClose} className="text-sm rounded-full border px-3 py-1.5 transition-colors shadow-sm"
            style={{ color: sidebar.headerText, borderColor: sidebar.cardBorder, background: sidebar.cardBackground }}>Hide</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Pool (drag from here) */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Collected Nodes</div>
          <div
            ref={(el) => { listRefs.current["pool"] = el; }}
            className="border rounded-md p-2 min-h-[72px] transition-colors"
            style={{
              borderColor: dropIndicator?.kind === "list" && dropIndicator.list === "pool" ? accent : sidebar.cardBorder,
              background:
                dropIndicator?.kind === "list" && dropIndicator.list === "pool"
                  ? accentBg
                  : sidebar.inputBackground,
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("application/x-node-id");
              if (!id) return;
              sendToPool(id);
            }}
          >
            {state.pool.length === 0 ? (
              <div className="text-[13px]" style={{ color: sidebar.textMuted }}>
                (drop or select nodes to collect them here)
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {state.pool.map((n, idx) => (
                  <React.Fragment key={n.id}>
                    {dropIndicator?.kind === "list" && dropIndicator.list === "pool" && dropIndicator.index === idx && (
                      <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                    )}
                    <div>
                      <DraggableChip node={n} source="pool" index={idx} />
                    </div>
                  </React.Fragment>
                ))}
                {dropIndicator?.kind === "list" && dropIndicator.list === "pool" && dropIndicator.index === state.pool.length && (
                  <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                )}
              </div>
            )}
          </div>
        </div>
        {/* Section tabs */}
        <div className="flex flex-wrap gap-2">
          {modeOrder.map((mode) => (
            <button
              key={mode}
              type="button"
              className="text-xs rounded-full border px-3 py-1.5 shadow-sm"
              onClick={() => handleSelectSection(mode)}
              style={{
                color: sidebar.textPrimary,
                borderColor: state.target.section === mode ? accent : sidebar.cardBorder,
                background: state.target.section === mode ? accentBg : sidebar.cardBackground,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = accentBg;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accent;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  state.target.section === mode ? accentBg : sidebar.cardBackground;
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  state.target.section === mode ? accent : sidebar.cardBorder;
              }}
            >
              {modeLabels[mode]}
            </button>
          ))}
        </div>

        {/* Argument Section */}
        {state.target.section === "argument" && (
          <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide" style={{ color: sidebar.textMuted }}>Argument</div>
            {renderGenerateButton("argument")}
          </div>
          <div className="space-y-2">
            <div
              ref={(el) => { mainRefs.current.argument = el; }}
              className="border rounded-md p-2"
              style={{
                borderColor: dropIndicator?.kind === "main" && dropIndicator.section === "argument" ? accent : sidebar.cardBorder,
                background: dropIndicator?.kind === "main" && dropIndicator.section === "argument" ? accentBg : sidebar.inputBackground,
              }}
            >
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Main Point</div>
              {state.argument.main ? (
                <div className="mt-1 text-[13px]" style={{ color: sidebar.textPrimary }}>
                  <DraggableChip
                    node={state.argument.main}
                    source="argument-main"
                    onReturnToPool={() => sendToPool(state.argument.main!.id)}
                  />
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select a node as main)</div>
              )}
              {/* Handle drop to set or replace main; push previous main to pool */}
              <div
                onDragOver={(e)=>e.preventDefault()}
                onDrop={(e)=>{
                  const id = e.dataTransfer.getData('application/x-node-id');
                  if (!id) return;
                  const incoming = (state.pool.find(x=>x.id===id) || state.argument.evidences.find(x=>x.id===id) || state.counter.evidences.find(x=>x.id===id) || state.script.outline.find(x=>x.id===id) || (state.counter.main?.id===id ? state.counter.main : null) || (state.argument.main?.id===id ? state.argument.main : null));
                  if (!incoming) return;
                  const prev = state.argument.main;
                  const next = { ...state };
                  // detach incoming from all
                  next.pool = next.pool.filter(x=>x.id!==id);
                  next.argument.evidences = next.argument.evidences.filter(x=>x.id!==id);
                  next.counter.evidences = next.counter.evidences.filter(x=>x.id!==id);
                  next.script.outline = next.script.outline.filter(x=>x.id!==id);
                  if (next.counter.main?.id===id) next.counter.main = null;
                  next.argument.main = incoming;
                  // return previous main to pool
                  if (prev && !next.pool.find(x=>x.id===prev.id)) next.pool = [...next.pool, prev];
                  onChangeState(next);
                }}
              />
            </div>
            <div className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }}>
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Evidences</div>
              <div
                ref={(el) => { listRefs.current["argument-evidences"] = el; }}
                className="flex flex-col gap-2 min-h-[32px]"
              >
                {state.argument.evidences.length === 0 ? (
                  <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes as evidences)</div>
                ) : (
                  state.argument.evidences.map((n, idx) => (
                    <React.Fragment key={n.id}>
                      {dropIndicator?.kind === "list" && dropIndicator.list === "argument-evidences" && dropIndicator.index === idx && (
                        <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                      )}
                      <div>
                        <DraggableChip node={n} source="argument-evidences" index={idx} onReturnToPool={() => sendToPool(n.id)} />
                      </div>
                    </React.Fragment>
                  ))
                )}
                {state.argument.evidences.length > 0 && dropIndicator?.kind === "list" && dropIndicator.list === "argument-evidences" && dropIndicator.index === state.argument.evidences.length && (
                  <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                )}
                {state.argument.evidences.length === 0 && dropIndicator?.kind === "list" && dropIndicator.list === "argument-evidences" && (
                  <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                )}
              </div>
              <div className="text-[11px] mt-2" style={{ color: sidebar.textMuted }}>
                Double-click any chip to move it back to Collected Nodes.
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Anti-Argument Section */}
        {state.target.section === "counter" && (
          <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide" style={{ color: sidebar.textMuted }}>Anti-Argument</div>
            {renderGenerateButton("counter")}
          </div>
          <div className="space-y-2">
            <div
              ref={(el) => { mainRefs.current.counter = el; }}
              className="border rounded-md p-2"
              style={{
                borderColor: dropIndicator?.kind === "main" && dropIndicator.section === "counter" ? accent : sidebar.cardBorder,
                background: dropIndicator?.kind === "main" && dropIndicator.section === "counter" ? accentBg : sidebar.inputBackground,
              }}
            >
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Main Point</div>
              {state.counter.main ? (
                <div className="mt-1 text-[13px]" style={{ color: sidebar.textPrimary }}>
                  <DraggableChip
                    node={state.counter.main}
                    source="counter-main"
                    onReturnToPool={() => sendToPool(state.counter.main!.id)}
                  />
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select a node as main)</div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Script Generation Section */}
        {state.target.section === "script" && (
          <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide" style={{ color: sidebar.textMuted }}>Script Generation</div>
            {renderGenerateButton("script")}
          </div>
          <div
            ref={(el) => { listRefs.current["script-outline"] = el; }}
            className="flex flex-col gap-2 min-h-[32px]"
          >
            {state.script.outline.length === 0 ? (
              <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes to form an outline)</div>
            ) : (
              state.script.outline.map((n, idx) => (
                <React.Fragment key={n.id}>
                  {dropIndicator?.kind === "list" && dropIndicator.list === "script-outline" && dropIndicator.index === idx && (
                    <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                  )}
                  <div>
                    <DraggableChip node={n} source="script-outline" index={idx} onReturnToPool={() => sendToPool(n.id)} />
                  </div>
                </React.Fragment>
              ))
            )}
            {state.script.outline.length > 0 && dropIndicator?.kind === "list" && dropIndicator.list === "script-outline" && dropIndicator.index === state.script.outline.length && (
              <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
            )}
            {state.script.outline.length === 0 && dropIndicator?.kind === "list" && dropIndicator.list === "script-outline" && (
              <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
            )}
            <div className="text-[11px] mt-2" style={{ color: sidebar.textMuted }}>
              Double-click any chip to move it back to Collected Nodes.
            </div>
          </div>
        </div>
        )}

        {/* Debate Section */}
        {state.target.section === "debate" && (
          <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide" style={{ color: sidebar.textMuted }}>Debate</div>
              {renderGenerateButton("debate")}
            </div>
            <p className="text-[12px] mb-2" style={{ color: sidebar.textMuted }}>
              Drop nodes to add them as debate participants. Double-click a chip to send it back to the pool.
            </p>
            <div
              ref={(el) => { listRefs.current["debate-participants"] = el; }}
              className="flex flex-col gap-2 min-h-[48px] border rounded-md p-2"
              style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }}
            >
              {state.debate.participants.length === 0 ? (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(add at least two participants)</div>
              ) : (
                state.debate.participants.map((n, idx) => (
                  <React.Fragment key={n.id}>
                    {dropIndicator?.kind === "list" && dropIndicator.list === "debate-participants" && dropIndicator.index === idx && (
                      <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                    )}
                    <div>
                      <DraggableChip node={n} source="debate-participants" index={idx} onReturnToPool={() => sendToPool(n.id)} />
                    </div>
                  </React.Fragment>
                ))
              )}
              {state.debate.participants.length > 0 && dropIndicator?.kind === "list" && dropIndicator.list === "debate-participants" && dropIndicator.index === state.debate.participants.length && (
                <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
              )}
              {state.debate.participants.length === 0 && dropIndicator?.kind === "list" && dropIndicator.list === "debate-participants" && (
                <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
              )}
            </div>
          </div>
        )}

        {/* Output Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Output</div>
          {modeOutputs.length === 0 ? (
            <div className="text-[13px]" style={{ color: sidebar.textMuted }}>No outputs yet. Generate something to see it here.</div>
          ) : (
            <div className="space-y-3">
              {modeOutputs.map((entry) => (
                <article
                  key={entry.id}
                  onClick={() => onSelectOutput(entry.id)}
                  className="rounded-lg border p-3 cursor-pointer transition-colors"
                  style={{
                    borderColor: activeOutputId === entry.id ? accent : sidebar.cardBorder,
                    background: activeOutputId === entry.id ? hexToRgba(accent, 0.14) : sidebar.inputBackground,
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-semibold" style={{ color: sidebar.textPrimary }}>
                      {entry.title}
                    </div>
                    <div className="text-[11px]" style={{ color: sidebar.textSecondary }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {entry.mode === "debate" && entry.debate ? (
                    <DebateOutputCard
                      debate={entry.debate}
                      textColor={sidebar.textPrimary}
                      mutedColor={sidebar.textSecondary}
                      borderColor={sidebar.cardBorder}
                    />
                  ) : (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: sidebar.textPrimary }}>
                      {entry.content}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
      {activeDrag && typeof document !== "undefined" &&
        createPortal(
          <div
            className="rounded-md px-2 py-1 border text-[12px] pointer-events-none shadow-lg"
            style={{
              position: "fixed",
              top: activeDrag.clientY - activeDrag.offsetY,
              left: activeDrag.clientX - activeDrag.offsetX,
              width: activeDrag.width,
              height: activeDrag.height,
              display: "flex",
              alignItems: "center",
              background: sidebar.inputBackground,
              borderColor: sidebar.cardBorder,
              color: sidebar.textPrimary,
              zIndex: 1000,
            }}
          >
            {getNodeLabel(activeDrag.node)}
          </div>,
          document.body
        )}
    </>
  );
}
