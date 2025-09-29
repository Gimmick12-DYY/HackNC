"use client";

import React, { useEffect, useRef, useState } from "react";
import { NodeItem } from "./types";
import { IconButton, Paper, TextField, Tooltip } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onText: (id: string, text: string) => void;
  onGenerate: (id: string) => void;
  highlight?: boolean;
};

export default function NodeCard({ node, onMove, onText, onGenerate, highlight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      onMove(node.id, e.clientX - offset.x, e.clientY - offset.y);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset, node.id, onMove]);

  const startDrag = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    setDragging(true);
    setOffset({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  };

  return (
    <div
      ref={ref}
      className={`absolute select-none transition-shadow ${
        highlight ? "ring-2 ring-sky-400" : ""
      }`}
      style={{ left: node.x, top: node.y }}
    >
      <Paper
        elevation={4}
        className="px-3 py-2 rounded-xl bg-white/90 backdrop-blur shadow-md border border-slate-200 min-w-[160px]"
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2">
          <TextField
            variant="standard"
            placeholder="Type an idea…"
            value={node.text}
            onChange={(e) => onText(node.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onGenerate(node.id);
            }}
            InputProps={{ disableUnderline: false }}
            className="flex-1"
          />
          <Tooltip title="Expand with AI">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onGenerate(node.id); }}>
              <AutoAwesomeRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </Paper>
    </div>
  );
}

