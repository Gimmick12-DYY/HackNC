"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { Tooltip } from "@mui/material";

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
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  
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

  const diameter = node.minimized 
    ? 24 // Larger dot size to be more visible
    : (node.size ?? 160);

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
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: highlight ? 30 : 10,
      }}
      initial={{ scale: 0.6, opacity: 0.5, x: node.x, y: node.y }}
      animate={{
        scale: 1,
        opacity: 1,
        width: diameter,
        height: diameter,
        rotate: 0,
        x: node.x,
        y: node.y,
      }}
      transition={{
        type: dragging ? "tween" : "spring",
        ease: dragging ? "linear" : undefined,
        duration: dragging ? 0 : 0.2,
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        x: { duration: dragging ? 0 : 0.001 },
        y: { duration: dragging ? 0 : 0.001 },
      }}
    >
      <motion.div
        className={`rounded-full backdrop-blur shadow-md border flex items-center justify-center text-center ${
          node.minimized 
            ? 'border-transparent' 
            : `bg-[#fffaf3] border-[#e6dccb] px-4 py-4 ${highlight ? 'ring-4 ring-sky-200/60 shadow-xl' : ''}`
        }`}
        onMouseDown={startDrag}
        onContextMenu={handleContextMenu}
        onClick={() => {
          if (node.minimized) {
            // Restore minimized node
            onMinimize?.(node.id);
          }
          // Remove direct click to expand for readOnly nodes - now use right-click menu
        }}
        animate={{
          width: diameter,
          height: diameter,
          backgroundColor: node.minimized ? node.dotColor : '#fffaf3',
          scale: node.minimized ? 0.8 : 1,
        }}
        transition={{
          type: dragging ? "tween" : "spring",
          ease: dragging ? "linear" : undefined,
          duration: dragging ? 0 : 0.2,
          stiffness: 320,
          damping: 28,
          mass: 0.6
        }}
        style={{
          boxShadow: node.minimized 
            ? '0 2px 8px rgba(0,0,0,0.15)' 
            : '0 4px 16px rgba(0,0,0,0.1)'
        }}
      >
        <motion.div
          animate={{
            opacity: node.minimized ? 0 : 1,
            scale: node.minimized ? 0.8 : 1,
          }}
        transition={{
          duration: 0.3,
          ease: "easeInOut"
        }}
      >
          {node.minimized ? null : (
            <Tooltip title={node.text || ""} arrow enterDelay={200}>
              <div
                className="text-slate-800 text-sm leading-snug text-center px-2"
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical' as any,
                  WebkitLineClamp: 3,
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}
              >
                {node.text || <span className="opacity-50">Awaiting content…</span>}
              </div>
            </Tooltip>
          )}
        </motion.div>
      </motion.div>
      

    </motion.div>
  );
}
