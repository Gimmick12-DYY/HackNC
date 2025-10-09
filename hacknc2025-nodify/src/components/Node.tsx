"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { Tooltip } from "@mui/material";
import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { getNodeColor } from "@/utils/getNodeColor";
import { getDisplayContent } from "@/utils/getDisplayContent";
import { useAttention } from "./Attention";

const toRgba = (hex: string, alpha: number) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return `rgba(204, 204, 204, ${alpha})`;
  }
  const value = parseInt(sanitized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string, x: number, y: number, originalX?: number, originalY?: number) => void;
  onMinimize?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId: string) => void;
  highlight?: boolean;
  screenToCanvas?: (screenX: number, screenY: number) => { x: number; y: number };
  onHoldStart?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onHoldMove?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onHoldEnd?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onClickNode?: (id: string) => void;
  onDoubleClickNode?: (id: string) => void;
  onUpdateText?: (id: string, value: string) => void;
  distance?: number;
};

export default function NodeCard({
  node,
  onMove,
  onMoveEnd,
  onMinimize,
  onContextMenu,
  highlight,
  screenToCanvas,
  onHoldStart,
  onHoldMove,
  onHoldEnd,
  onClickNode,
  onDoubleClickNode,
  onUpdateText,
  distance = Number.POSITIVE_INFINITY,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { setFocusedNode, focusedNodeId } = useAttention();
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.full || node.text || "");
  const sanitizedDistance = useMemo(
    () =>
      Number.isFinite(distance)
        ? Math.max(0, Math.floor(distance as number))
        : Number.POSITIVE_INFINITY,
    [distance]
  );
  const sizeLevels = NodeVisualConfig.SIZE_LEVELS as Record<number, number>;
  const baseDiameter = node.minimized ? 24 : node.size ?? sizeLevels[0];
  const targetDiameter = node.minimized
    ? 24
    : Number.isFinite(distance) && sizeLevels[sanitizedDistance] !== undefined
    ? sizeLevels[sanitizedDistance]
    : NodeVisualConfig.SIZE_LEVELS.SMALLEST_SIZE;
  const scaleFactor =
    node.minimized || baseDiameter === 0 ? 1 : targetDiameter / baseDiameter;
  const visualScale = node.minimized ? 0.85 : scaleFactor;
  const displayContent = useMemo(
    () => getDisplayContent(node, distance),
    [node, distance]
  );
  const nodeColor = getNodeColor(node.type);
  const backgroundColor = node.minimized
    ? node.dotColor ?? nodeColor
    : toRgba(nodeColor, 0.18);
  const borderColor = node.minimized ? nodeColor : toRgba(nodeColor, 0.5);
  const isFocused = focusedNodeId === node.id;
  const transition = NodeVisualConfig.TRANSITION;
  const fontSizes = [16, 13, 11, 10];
  const fontSize =
    !Number.isFinite(distance) || sanitizedDistance > 3
      ? 9
      : fontSizes[sanitizedDistance];
  const textOpacity = !Number.isFinite(distance)
    ? 0.5
    : sanitizedDistance === 0
    ? 1
    : sanitizedDistance === 1
    ? 0.9
    : sanitizedDistance === 2
    ? 0.75
    : 0.6;
  
  // Use refs to store callback functions to avoid dependency issues
  const onMoveRef = useRef(onMove);
  const onMoveEndRef = useRef(onMoveEnd);
  const onHoldStartRef = useRef(onHoldStart);
  const onHoldMoveRef = useRef(onHoldMove);
  const onHoldEndRef = useRef(onHoldEnd);
  
  // Update refs when callbacks change
  onMoveRef.current = onMove;
  onMoveEndRef.current = onMoveEnd;
  onHoldStartRef.current = onHoldStart;
  onHoldMoveRef.current = onHoldMove;
  onHoldEndRef.current = onHoldEnd;

  // Use ref to store current offset to avoid dependency issues
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  useEffect(() => {
    if (!dragging) return;
    
    // Capture current values in closure to avoid stale closure issues
    const currentDragStartPosition = dragStartPositionRef.current;
    const nodeId = node.id;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Convert screen coordinates to world coordinates
      if (screenToCanvas) {
        const worldPos = screenToCanvas(e.clientX, e.clientY);
        onMoveRef.current(nodeId, worldPos.x - offsetRef.current.x, worldPos.y - offsetRef.current.y);
      } else {
        // Fallback to old behavior if no conversion function provided
        onMoveRef.current(nodeId, e.clientX - offsetRef.current.x, e.clientY - offsetRef.current.y);
      }
      onHoldMoveRef.current?.({ nodeId, clientX: e.clientX, clientY: e.clientY });
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // Convert screen coordinates to world coordinates
      let finalX, finalY;
      if (screenToCanvas) {
        const worldPos = screenToCanvas(e.clientX, e.clientY);
        finalX = worldPos.x - offsetRef.current.x;
        finalY = worldPos.y - offsetRef.current.y;
      } else {
        // Fallback to old behavior if no conversion function provided
        finalX = e.clientX - offsetRef.current.x;
        finalY = e.clientY - offsetRef.current.y;
      }
      onMoveEndRef.current(nodeId, finalX, finalY, currentDragStartPosition.x, currentDragStartPosition.y);
      onHoldEndRef.current?.({ nodeId, clientX: e.clientX, clientY: e.clientY });
      setDragging(false);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, node.id, screenToCanvas]);

  const startDrag = (e: React.MouseEvent) => {
    if (editing) return; // 正在编辑时不允许拖拽
    // Don't start drag if clicking on TextField or input elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.MuiTextField-root')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Capture the ACTUAL current position immediately when drag starts
    // This ensures we get the real position even if node is mid-animation
    const currentPosition = { x: node.x, y: node.y };
    dragStartPositionRef.current = currentPosition;
    
    setDragging(true);
    // Calculate offset from mouse position to node's current position
    if (screenToCanvas) {
      const worldPos = screenToCanvas(e.clientX, e.clientY);
      setOffset({ x: worldPos.x - node.x, y: worldPos.y - node.y });
    } else {
      // Fallback to old behavior if no conversion function provided
      setOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
    }
    onHoldStartRef.current?.({ nodeId: node.id, clientX: e.clientX, clientY: e.clientY });
  };


  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, node.id);
  };



  return (
    <motion.div
      ref={ref}
      className="select-none node-card"
      data-node-id={node.id}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: highlight || isFocused ? 30 : 10,
        width: baseDiameter,
        height: baseDiameter,
      }}
      initial={{
        opacity: 0.6,
        x: node.x,
        y: node.y,
      }}
      animate={{
        opacity: 1,
        x: node.x,
        y: node.y,
        width: baseDiameter,
        height: baseDiameter,
      }}
      transition={{
        type: dragging ? "tween" : "spring",
        ease: dragging ? "linear" : transition.ease,
        duration: dragging ? 0 : transition.duration,
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        opacity: { duration: 0.2 },
        x: { duration: dragging ? 0 : 0.001 },
        y: { duration: dragging ? 0 : 0.001 },
      }}
    >
      <motion.div
        className="rounded-full backdrop-blur flex items-center justify-center text-center px-4 py-4"
        onMouseDown={startDrag}
        onContextMenu={handleContextMenu}
        onClick={() => {
          if (node.minimized) {
            onMinimize?.(node.id);
          }
          if (!dragging) {
            setFocusedNode(node.id);
            onClickNode?.(node.id);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!dragging) {
            setEditing(true);
            setDraft(node.full || node.text || "");
            onDoubleClickNode?.(node.id);
          }
        }}
        animate={{
          backgroundColor,
          borderColor,
          borderWidth: node.minimized ? 0 : isFocused ? 3 : 2,
          borderStyle: "solid",
          scale: visualScale,
        }}
        transition={{
          duration: dragging ? 0 : transition.duration,
          ease: dragging ? "linear" : transition.ease,
        }}
        style={{
          width: baseDiameter,
          height: baseDiameter,
          transformOrigin: "center",
          boxShadow:
            highlight || isFocused
              ? "0 12px 30px rgba(15,23,42,0.25)"
              : "0 6px 18px rgba(15,23,42,0.16)",
          color: node.minimized ? "#ffffff" : "#1f2937",
        }}
      >
        <motion.div
          animate={{
            opacity: node.minimized ? 0 : 1,
            scale: node.minimized ? 0.75 : 1,
          }}
          transition={{
            duration: transition.duration,
            ease: transition.ease,
          }}
          className="flex h-full w-full items-center justify-center px-2"
        >
          {node.minimized
            ? null
            : editing
            ? (
              <textarea
                autoFocus
                className="w-[90%] h-[70%] resize-none outline-none bg-transparent text-center leading-snug"
                style={{ lineHeight: "1.25rem", fontSize }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  setEditing(false);
                  onUpdateText?.(node.id, draft.trim());
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                    setDraft(node.full || node.text || "");
                  }
                }}
              />
            )
            : (
              <Tooltip title={node.full || node.text || ""} arrow enterDelay={200}>
                <div
                  className="text-center"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical" as const,
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    wordBreak: "break-word",
                    fontSize,
                    opacity: textOpacity,
                    color: "#1f2937",
                  }}
                >
                  {displayContent || (
                    <span className="opacity-50">Awaiting content...</span>
                  )}
                </div>
              </Tooltip>
            )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
