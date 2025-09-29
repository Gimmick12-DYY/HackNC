"use client";

import React from "react";
import { NodeItem } from "./types";
import { Paper } from "@mui/material";

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onGenerate: (id: string) => void;
};

export default function SubNode({ node, onMove, onGenerate }: Props) {
  const [dragging, setDragging] = React.useState(false);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging) return;
      onMove(node.id, e.clientX - offset.x, e.clientY - offset.y);
    };
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, offset, node.id, onMove]);

  const start = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    setDragging(true);
    setOffset({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  };

  return (
    <div ref={ref} className="absolute" style={{ left: node.x, top: node.y }}>
      <Paper
        elevation={2}
        className="px-2 py-1 rounded-lg bg-white/90 backdrop-blur shadow border border-slate-200 min-w-[120px]"
        onMouseDown={start}
        onDoubleClick={() => onGenerate(node.id)}
      >
        <div className="text-slate-700 text-sm leading-tight truncate max-w-[200px]">
          {node.text}
        </div>
      </Paper>
    </div>
  );
}
