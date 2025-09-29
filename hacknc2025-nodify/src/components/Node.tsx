"use client";

import React, { useEffect, useRef, useState } from "react";
import { NodeItem } from "./types";
import { IconButton, Paper, TextField, Tooltip } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { motion } from "framer-motion";

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onText: (id: string, text: string) => void;
  onGenerate: (id: string) => void;
  onConfirm: (id: string) => void;
  highlight?: boolean;
  readOnly?: boolean; // for child nodes
};

export default function NodeCard({ node, onMove, onText, onGenerate, onConfirm, highlight, readOnly }: Props) {
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

  const diameter = Math.max(120, Math.min(node.size ?? 160, 420));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key.toLowerCase() === "enter") {
      onConfirm(node.id);
      onGenerate(node.id);
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`absolute select-none ${highlight ? "ring-2 ring-sky-400" : ""}`}
      style={{ left: node.x, top: node.y }}
      initial={{ scale: 0.6, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.8 }}
    >
      <Paper
        elevation={4}
        className="rounded-full bg-[#fffaf3] backdrop-blur shadow-md border border-[#e6dccb] flex items-center justify-center text-center px-4 py-4"
        onMouseDown={startDrag}
        onClick={() => {
          if (readOnly) onGenerate(node.id);
        }}
        style={{ width: diameter, height: diameter }}
      >
        {readOnly ? (
          <div className="text-slate-800 text-sm whitespace-pre-wrap break-words leading-snug">
            {node.text}
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <TextField
              variant="standard"
              placeholder="Type an idea…"
              value={node.text}
              onChange={(e) => onText(node.id, e.target.value)}
              onKeyDown={onKey}
              InputProps={{ disableUnderline: false }}
              multiline
              className="flex-1"
            />
            <Tooltip title="Expand with AI">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm(node.id);
                  onGenerate(node.id);
                }}
              >
                <AutoAwesomeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </Paper>
    </motion.div>
  );
}
