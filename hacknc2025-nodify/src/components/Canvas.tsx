"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NodeCard from "./Node";
import { DashboardParams, NodeItem } from "./types";

type Props = {
  params: DashboardParams;
};

type NodeMap = Record<string, NodeItem>;

export default function Canvas({ params }: Props) {
  const [nodes, setNodes] = useState<NodeMap>({});
  const [edges, setEdges] = useState<Array<[string, string]>>([]); // [parent, child]
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const nextId = () => `n_${idRef.current++}`;

  const computeSize = (text: string) => {
    const len = text.trim().length;
    const w = 140 + len * 6; // 6px per char heuristic
    return Math.max(140, Math.min(w, 420));
  };

  const constrainPosition = (x: number, y: number, nodeSize: number = 160) => {
    const padding = 20; // Keep nodes away from edges
    const maxX = Math.max(0, canvasSize.width - nodeSize - padding);
    const maxY = Math.max(0, canvasSize.height - nodeSize - padding);
    
    return {
      x: Math.max(padding, Math.min(x, maxX)),
      y: Math.max(padding, Math.min(y, maxY))
    };
  };

  const addNodeAt = (x: number, y: number, parentId?: string | null, text = "") => {
    const id = nextId();
    const node: NodeItem = {
      id,
      x,
      y,
      text,
      parentId: parentId ?? null,
      children: [],
      isDraft: !parentId, // top-level clicks start as draft; children are confirmed
      size: computeSize(text),
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    if (parentId) setEdges((e) => [...e, [parentId, id]]);
    setSelectedId(id);
    if (!parentId) setDraftId(id);
    return id;
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return; // ignore clicks on children
    // If a draft exists, cancel it and do not create a new one
    if (draftId) {
      setNodes((prev) => {
        const updated = { ...prev };
        delete updated[draftId];
        return updated;
      });
      setDraftId(null);
      setSelectedId(null);
      return;
    }
    // Place relative to the canvas
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left - 80; // center offset
    const y = e.clientY - rect.top - 20;
    addNodeAt(x, y);
  };

  const onMove = (id: string, x: number, y: number) => {
    const node = nodes[id];
    const nodeSize = node?.size ?? 160;
    const constrained = constrainPosition(x, y, nodeSize);
    setNodes((prev) => ({ ...prev, [id]: { ...prev[id], x: constrained.x, y: constrained.y } }));
  };

  const onText = (id: string, text: string) => {
    setNodes((prev) => ({
      ...prev,
      [id]: { ...prev[id], text, size: computeSize(text) },
    }));
  };

  const onConfirm = (id: string) => {
    setNodes((prev) => ({ ...prev, [id]: { ...prev[id], isDraft: false } }));
    if (draftId === id) setDraftId(null);
  };

  // Handle window resize and constrain existing nodes
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size
    updateCanvasSize();

    // Listen for resize
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Constrain all nodes when canvas size changes
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      setNodes((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          const node = updated[id];
          const nodeSize = node.size ?? 160;
          const constrained = constrainPosition(node.x, node.y, nodeSize);
          updated[id] = { ...node, x: constrained.x, y: constrained.y };
        });
        return updated;
      });
    }
  }, [canvasSize]);

  const arrangeAround = (cx: number, cy: number, count: number, radius: number) => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (2 * Math.PI * i) / count;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { x, y };
    });
  };

  const onGenerate = useCallback(
    async (id: string) => {
      const node = nodes[id];
      if (!node || !node.text.trim()) return;
      const prompt = `Given the parent idea: "${node.text.trim()}"\nGenerate ${params.nodeCount} concise sub-ideas (${params.phraseLength} chars each). Return as a JSON array of strings.`;
      let items: string[] = [];
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            count: params.nodeCount,
            phraseLength: params.phraseLength,
            temperature: params.temperature,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          items = data.items as string[];
        }
      } catch (err) {
        console.error(err);
      }
      if (!items || items.length === 0) return;

      const positions = arrangeAround(node.x, node.y, items.length, 160);
      const childEdges: [string, string][] = [];
      const createdIds: string[] = [];
      // Step 1: create clustered at parent
      setNodes((prev) => {
        const updated = { ...prev };
        const parent = updated[id];
        const childIds: string[] = [];
        items.forEach((text) => {
          const jitter = () => (Math.random() - 0.5) * 12;
          const childId = nextId();
          updated[childId] = {
            id: childId,
            text,
            x: node.x + jitter(),
            y: node.y + jitter(),
            parentId: id,
            children: [],
            isDraft: false,
            size: computeSize(text),
          };
          childIds.push(childId);
          createdIds.push(childId);
          childEdges.push([id, childId]);
        });
        updated[id] = { ...parent, children: [...parent.children, ...childIds], expanded: true };
        return updated;
      });
      setEdges((e) => [...e, ...childEdges]);
      // Step 2: animate out to final radial positions
      setTimeout(() => {
        setNodes((prev) => {
          const updated = { ...prev };
          createdIds.forEach((cid, idx) => {
            const p = positions[idx];
            if (updated[cid]) updated[cid] = { ...updated[cid], x: p.x, y: p.y };
          });
          return updated;
        });
      }, 30);
    },
    [nodes, params.nodeCount, params.phraseLength, params.temperature]
  );

  const lines = useMemo(() => {
    const pairs = edges
      .map(([p, c]) => {
        const parent = nodes[p];
        const child = nodes[c];
        if (!parent || !child) return null;
        const pX = parent.x + (parent.size ?? 160) / 2;
        const pY = parent.y + (parent.size ?? 160) / 2;
        const cX = child.x + (child.size ?? 140) / 2;
        const cY = child.y + (child.size ?? 140) / 2;
        return { pX, pY, cX, cY, key: `${p}-${c}` };
      })
      .filter(Boolean) as Array<{ pX: number; pY: number; cX: number; cY: number; key: string }>;
    return pairs;
  }, [edges, nodes]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[calc(100vh-64px)] bg-gradient-to-br from-[#f7f2e8] to-[#f3eadb] overflow-hidden"
      onClick={onCanvasClick}
    >
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
        {lines.map(({ pX, pY, cX, cY, key }) => (
          <line key={key} x1={pX} y1={pY} x2={cX} y2={cY} stroke="#94a3b8" strokeWidth={1.5} />
        ))}
      </svg>

      {Object.values(nodes).map((n) => (
        <NodeCard
          key={n.id}
          node={n}
          onMove={onMove}
          onText={onText}
          onGenerate={onGenerate}
          onConfirm={onConfirm}
          highlight={selectedId === n.id}
          readOnly={!!n.parentId}
        />
      ))}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-500 text-sm bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow select-none" style={{ caretColor: 'transparent' }}>
        Click anywhere to add a node. Drag to reposition. Press Enter or sparkle to expand.
      </div>
    </div>
  );
}
