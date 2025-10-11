"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { useTheme, hexToRgba } from "./Themes";

type CollectorState = {
  argument: { main: NodeItem | null; evidences: NodeItem[] };
  counter: { main: NodeItem | null; evidences: NodeItem[] };
  script: { outline: NodeItem[] };
  target: { section: 'argument' | 'counter' | 'script'; field: 'main' | 'evidence' | 'outline' };
  pool: NodeItem[];
};

type Props = {
  width: number;
  onResize: (width: number) => void;
  onClose: () => void;
  state: CollectorState;
  onChangeState: (next: CollectorState) => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onGenerateScript?: () => Promise<string>;
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 520;

type DragListKey = "pool" | "argument-evidences" | "counter-evidences" | "script-outline";
type DragSourceKey = DragListKey | "argument-main" | "counter-main";

const DRAG_LIST_KEYS: readonly DragListKey[] = [
  "pool",
  "argument-evidences",
  "counter-evidences",
  "script-outline",
] as const;

type DropIndicator =
  | { kind: "list"; list: DragListKey; index: number }
  | { kind: "main"; section: "argument" | "counter" }
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

export default function CollectorPanel({ width, onResize, onClose, state, onChangeState, selectionMode, onToggleSelectionMode, onGenerateScript }: Props) {
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
      default:
        return draft.pool;
    }
  }, []);

  const detachNode = React.useCallback((draft: CollectorState, id: string) => {
    draft.pool = draft.pool.filter((x) => x.id !== id);
    draft.argument.evidences = draft.argument.evidences.filter((x) => x.id !== id);
    draft.counter.evidences = draft.counter.evidences.filter((x) => x.id !== id);
    draft.script.outline = draft.script.outline.filter((x) => x.id !== id);
    if (draft.argument.main?.id === id) draft.argument.main = null;
    if (draft.counter.main?.id === id) draft.counter.main = null;
  }, []);

  const [activeDrag, setActiveDrag] = React.useState<ActiveDragState | null>(null);
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator>(null);

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
  });
  const mainRefs = React.useRef<{ argument: HTMLDivElement | null; counter: HTMLDivElement | null }>({
    argument: null,
    counter: null,
  });

  React.useEffect(() => { activeDragRef.current = activeDrag; }, [activeDrag]);
  React.useEffect(() => { dropIndicatorRef.current = dropIndicator; }, [dropIndicator]);

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
        detachNode(draft, dragData.node.id);
        if (dropTarget.section === "argument") {
          draft.argument.main = dragData.node;
        } else {
          draft.counter.main = dragData.node;
        }
      });
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

  const DraggableChip: React.FC<{ node: NodeItem; source: DragSourceKey; index?: number }> = ({ node, source, index }) => {
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
          <button type="button" onClick={onToggleSelectionMode} className="text-sm rounded-full border px-3 py-1.5 transition-colors shadow-sm"
            style={{ color: sidebar.headerText, borderColor: selectionMode ? accent : sidebar.cardBorder, background: selectionMode ? accentBg : sidebar.cardBackground }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = selectionMode ? accentBgHover : accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = selectionMode ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = selectionMode ? accent : sidebar.cardBorder; }}>
            {selectionMode ? "Selecting…" : "Select nodes"}
          </button>
          <button type="button" onClick={onClose} className="text-sm rounded-full border px-3 py-1.5 transition-colors shadow-sm"
            style={{ color: sidebar.headerText, borderColor: sidebar.cardBorder, background: sidebar.cardBackground }}>Hide</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Pool (drag from here) */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Collected Nodes (Drag to sections)</div>
          {state.pool.length === 0 ? (
            <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(none yet)</div>
          ) : (
            <div
              ref={(el) => { listRefs.current["pool"] = el; }}
              className="flex flex-col gap-2"
            >
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
              {state.pool.length === 0 && dropIndicator?.kind === "list" && dropIndicator.list === "pool" && (
                <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
              )}
            </div>
          )}
        </div>
        {/* Section tabs */}
        <div className="flex gap-2">
          {(['argument','counter','script'] as const).map((sec) => (
            <button key={sec} type="button" className="text-xs rounded-full border px-3 py-1.5 shadow-sm"
              onClick={() => onChangeState({ ...state, target: { section: sec, field: sec==='script' ? 'outline' : (state.target.field==='outline' ? 'evidence' : state.target.field) } })}
              style={{ color: sidebar.textPrimary, borderColor: state.target.section===sec ? accent : sidebar.cardBorder, background: state.target.section===sec ? accentBg : sidebar.cardBackground }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = state.target.section===sec ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = state.target.section===sec ? accent : sidebar.cardBorder; }}>
              {sec === 'argument' ? 'Argument' : sec === 'counter' ? 'Anti-Argument' : 'Script'}
            </button>
          ))}
        </div>

        {/* Argument Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Argument</div>
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
                  <DraggableChip node={state.argument.main} source="argument-main" />
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select a node as main)</div>
              )}
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs rounded-full border px-2 py-1 shadow-sm"
                  style={{ color: sidebar.textPrimary, borderColor: state.target.section==='argument' && state.target.field==='main' ? accent : sidebar.cardBorder, background: state.target.section==='argument' && state.target.field==='main' ? accentBg : sidebar.cardBackground }}
                  onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }}
                  onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = state.target.section==='argument' && state.target.field==='main' ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = state.target.section==='argument' && state.target.field==='main' ? accent : sidebar.cardBorder; }}
                  onClick={() => onChangeState({ ...state, target: { section: 'argument', field: 'main' } })}>Set Main</button>
              </div>
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
                        <DraggableChip node={n} source="argument-evidences" index={idx} />
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
              {/* Drop instead of button */}
            </div>
          </div>
        </div>

        {/* Anti-Argument Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Anti-Argument</div>
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
                  <DraggableChip node={state.counter.main} source="counter-main" />
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select a node as main)</div>
              )}
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs rounded-full border px-2 py-1 shadow-sm" style={{ color: sidebar.textPrimary, borderColor: state.target.section==='counter' && state.target.field==='main' ? accent : sidebar.cardBorder, background: state.target.section==='counter' && state.target.field==='main' ? accentBg : sidebar.cardBackground }} onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }} onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = state.target.section==='counter' && state.target.field==='main' ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = state.target.section==='counter' && state.target.field==='main' ? accent : sidebar.cardBorder; }} onClick={() => onChangeState({ ...state, target: { section: 'counter', field: 'main' } })}>Set Main</button>
              </div>
            </div>
            <div className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }}>
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Evidences</div>
              <div
                ref={(el) => { listRefs.current["counter-evidences"] = el; }}
                className="flex flex-col gap-2 min-h-[32px]"
              >
                {state.counter.evidences.length === 0 ? (
                  <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes as evidences)</div>
                ) : (
                  state.counter.evidences.map((n, idx) => (
                    <React.Fragment key={n.id}>
                      {dropIndicator?.kind === "list" && dropIndicator.list === "counter-evidences" && dropIndicator.index === idx && (
                        <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                      )}
                      <div>
                        <DraggableChip node={n} source="counter-evidences" index={idx} />
                      </div>
                    </React.Fragment>
                  ))
                )}
                {state.counter.evidences.length > 0 && dropIndicator?.kind === "list" && dropIndicator.list === "counter-evidences" && dropIndicator.index === state.counter.evidences.length && (
                  <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                )}
                {state.counter.evidences.length === 0 && dropIndicator?.kind === "list" && dropIndicator.list === "counter-evidences" && (
                  <div className="h-[3px] rounded-full" style={{ background: dropAccent }} />
                )}
              </div>
              {/* Drop instead of button */}
            </div>
          </div>
        </div>

        {/* Script Generation Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Script Generation</div>
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
                    <DraggableChip node={n} source="script-outline" index={idx} />
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
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="text-xs rounded-full border px-3 py-1.5 shadow-sm" style={{ color: sidebar.textPrimary, borderColor: accent, background: accentBg }} onClick={() => onChangeState({ ...state, target: { section: 'script', field: 'outline' } })}>Add Outline Item (select mode)</button>
            {onGenerateScript && (
              <button type="button" className="text-xs rounded-full border px-3 py-1.5 shadow-sm" style={{ color: sidebar.textPrimary, borderColor: accent, background: accentBg }} onClick={async ()=>{
                const script = await onGenerateScript();
                if (script) alert(script);
              }}>Generate Script</button>
            )}
          </div>
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
