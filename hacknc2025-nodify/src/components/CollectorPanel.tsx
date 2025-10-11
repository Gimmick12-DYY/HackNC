"use client";

import React from "react";
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

export default function CollectorPanel({ width, onResize, onClose, state, onChangeState, selectionMode, onToggleSelectionMode, onGenerateScript }: Props) {
  const { theme } = useTheme();
  const sidebar = theme.ui.sidebar;
  const accent = sidebar.inputFocus;
  const accentBg = hexToRgba(accent, 0.12);
  const accentBgHover = hexToRgba(accent, 0.2);

  // Helpers to fetch a node by id from anywhere in collector state
  const findNodeById = React.useCallback((id: string): NodeItem | null => {
    const pools: NodeItem[][] = [
      state.pool,
      state.argument.evidences,
      state.counter.evidences,
      state.script.outline,
    ];
    for (const list of pools) {
      const n = list.find((x) => x.id === id);
      if (n) return n;
    }
    if (state.argument.main?.id === id) return state.argument.main;
    if (state.counter.main?.id === id) return state.counter.main;
    return null;
  }, [state]);

  const createDragImage = (text: string) => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.left = '-1000px';
    el.style.padding = '6px 10px';
    el.style.borderRadius = '8px';
    el.style.background = sidebar.inputBackground;
    el.style.border = `1px solid ${sidebar.cardBorder}`;
    el.style.color = sidebar.textPrimary;
    el.style.fontSize = '12px';
    el.style.opacity = '1';
    document.body.appendChild(el);
    return el;
  };

  type ChipSource = 'pool' | 'arg-evi' | 'ctr-evi' | 'script' | 'arg-main' | 'ctr-main';
  const DraggableChip: React.FC<{ node: NodeItem; source: ChipSource }> = ({ node, source }) => {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-node-id', node.id);
          e.dataTransfer.setData('text/source', source);
          const ghost = createDragImage(node.text || node.full || node.short || node.id);
          e.dataTransfer.setDragImage(ghost, 10, 10);
          // cleanup on end
          const cleanup = () => { ghost.remove(); window.removeEventListener('dragend', cleanup as any); };
          window.addEventListener('dragend', cleanup as any, { once: true });
        }}
        className="rounded-md px-2 py-1 border text-[12px] cursor-grab select-none"
        style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground, color: sidebar.textPrimary }}
      >
        {node.text || node.full || node.short || node.id}
      </div>
    );
  };

  const removeFromAll = (id: string, draft: CollectorState): CollectorState => {
    const next = { ...draft } as CollectorState;
    next.pool = next.pool.filter((x) => x.id !== id);
    next.argument.evidences = next.argument.evidences.filter((x) => x.id !== id);
    next.counter.evidences = next.counter.evidences.filter((x) => x.id !== id);
    next.script.outline = next.script.outline.filter((x) => x.id !== id);
    if (next.argument.main?.id === id) next.argument.main = null;
    if (next.counter.main?.id === id) next.counter.main = null;
    return next;
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
            <div className="flex flex-wrap gap-2">
              {state.pool.map((n, idx) => (
                <DraggableChip key={`${n.id}-${idx}`} node={n} source="pool" />
              ))}
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
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
          const id = e.dataTransfer.getData('application/x-node-id');
          const found = state.pool.find((x)=>x.id===id);
          if (!found) return;
          onChangeState({ ...state, argument: { ...state.argument, evidences: state.argument.evidences.find(x=>x.id===id) ? state.argument.evidences : [...state.argument.evidences, found] } });
        }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Argument</div>
          <div className="space-y-2">
            <div className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
              const id = e.dataTransfer.getData('application/x-node-id');
              const found = findNodeById(id);
              if (!found) return;
              onChangeState(removeFromAll(id, { ...state, argument: { ...state.argument, main: found } }));
            }}>
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Main Point</div>
              <div className="text-[13px]" style={{ color: sidebar.textPrimary }}>{state.argument.main?.text || '(select a node as main)'}</div>
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
              {state.argument.evidences.length === 0 ? (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes as evidences)</div>
              ) : (
                <div className="flex flex-wrap gap-2" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
                  const id = e.dataTransfer.getData('application/x-node-id');
                  const found = findNodeById(id);
                  if (!found) return;
                  const exists = state.argument.evidences.find(x=>x.id===id);
                  if (!exists) onChangeState(removeFromAll(id, { ...state, argument: { ...state.argument, evidences: [...state.argument.evidences, found] } }));
                }}>
                  {state.argument.evidences.map((n, idx) => (
                    <DraggableChip key={n.id} node={n} source="arg-evi" />
                  ))}
                </div>
              )}
              {/* Drop instead of button */}
            </div>
          </div>
        </div>

        {/* Anti-Argument Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
          const id = e.dataTransfer.getData('application/x-node-id');
          const found = state.pool.find((x)=>x.id===id);
          if (!found) return;
          onChangeState({ ...state, counter: { ...state.counter, evidences: state.counter.evidences.find(x=>x.id===id) ? state.counter.evidences : [...state.counter.evidences, found] } });
        }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Anti-Argument</div>
          <div className="space-y-2">
            <div className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
              const id = e.dataTransfer.getData('application/x-node-id');
              const found = findNodeById(id);
              if (!found) return;
              onChangeState(removeFromAll(id, { ...state, counter: { ...state.counter, main: found } }));
            }}>
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Main Point</div>
              <div className="text-[13px]" style={{ color: sidebar.textPrimary }}>{state.counter.main?.text || '(select a node as main)'}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs rounded-full border px-2 py-1 shadow-sm" style={{ color: sidebar.textPrimary, borderColor: state.target.section==='counter' && state.target.field==='main' ? accent : sidebar.cardBorder, background: state.target.section==='counter' && state.target.field==='main' ? accentBg : sidebar.cardBackground }} onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = accentBg; (e.currentTarget as HTMLButtonElement).style.borderColor = accent; }} onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background = state.target.section==='counter' && state.target.field==='main' ? accentBg : sidebar.cardBackground; (e.currentTarget as HTMLButtonElement).style.borderColor = state.target.section==='counter' && state.target.field==='main' ? accent : sidebar.cardBorder; }} onClick={() => onChangeState({ ...state, target: { section: 'counter', field: 'main' } })}>Set Main</button>
              </div>
            </div>
            <div className="border rounded-md p-2" style={{ borderColor: sidebar.cardBorder, background: sidebar.inputBackground }}>
              <div className="text-[12px] mb-1" style={{ color: sidebar.textMuted }}>Evidences</div>
              {state.counter.evidences.length === 0 ? (
                <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes as evidences)</div>
              ) : (
                <div className="flex flex-wrap gap-2" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
                  const id = e.dataTransfer.getData('application/x-node-id');
                  const found = findNodeById(id);
                  if (!found) return;
                  const exists = state.counter.evidences.find(x=>x.id===id);
                  if (!exists) onChangeState(removeFromAll(id, { ...state, counter: { ...state.counter, evidences: [...state.counter.evidences, found] } }));
                }}>
                  {state.counter.evidences.map((n) => (
                    <DraggableChip key={n.id} node={n} source="ctr-evi" />
                  ))}
                </div>
              )}
              {/* Drop instead of button */}
            </div>
          </div>
        </div>

        {/* Script Generation Section */}
        <div className="rounded-lg p-3 border" style={{ background: sidebar.cardBackground, borderColor: sidebar.cardBorder }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
          const id = e.dataTransfer.getData('application/x-node-id');
          const found = state.pool.find((x)=>x.id===id);
          if (!found) return;
          onChangeState({ ...state, script: { outline: state.script.outline.find(x=>x.id===id) ? state.script.outline : [...state.script.outline, found] } });
        }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: sidebar.textMuted }}>Script Generation</div>
          {state.script.outline.length === 0 ? (
            <div className="text-[13px]" style={{ color: sidebar.textMuted }}>(select nodes to form an outline)</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.script.outline.map((n) => (
                <DraggableChip key={n.id} node={n} source="script" />
              ))}
            </div>
          )}
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
  );
}


