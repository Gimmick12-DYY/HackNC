"use client";

import React, { useEffect, useRef, useState } from "react";
import { NodeItem } from "./types";
import { TextField } from "@mui/material";
import { motion } from "framer-motion";

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string, x: number, y: number, originalX?: number, originalY?: number) => void;
  onText: (id: string, text: string) => void;
  onGenerate: (id: string) => void;
  onConfirm: (id: string) => void;
  onDelete?: (id: string) => void;
  onMinimize?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId: string) => void;
  highlight?: boolean;
  readOnly?: boolean; // for child nodes
};

export default function NodeCard({ node, onMove, onMoveEnd, onText, onGenerate, onConfirm, onDelete, onMinimize, onContextMenu, highlight, readOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDeleting, setIsDeleting] = useState(false);

  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const lastGenerateTimeRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    
    // Capture current values in closure to avoid stale closure issues
    const currentOffset = offset;
    const currentDragStartPosition = dragStartPositionRef.current;
    const nodeId = node.id;
    
    const handleMouseMove = (e: MouseEvent) => {
      // During drag, just update position without collision detection
      onMove(nodeId, e.clientX - currentOffset.x, e.clientY - currentOffset.y);
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // On drag end, perform collision detection
      const finalX = e.clientX - currentOffset.x;
      const finalY = e.clientY - currentOffset.y;
      onMoveEnd(nodeId, finalX, finalY, currentDragStartPosition.x, currentDragStartPosition.y);
      setDragging(false);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset.x, offset.y, node.id]);

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
    setDragStartPosition(currentPosition);
    
    setDragging(true);
    // Calculate offset from mouse position to node's current position
    setOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  };

  const diameter = node.minimized 
    ? 24 // Larger dot size to be more visible
    : Math.max(120, Math.min(node.size ?? 160, 420));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key.toLowerCase() === "enter") {
      // Prevent double execution by checking timing
      const now = Date.now();
      if (now - lastGenerateTimeRef.current < 1000) {
        return; // Prevent execution if called within 1 second
      }
      lastGenerateTimeRef.current = now;
      
      onConfirm(node.id);
      onGenerate(node.id);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    // Wait for animation to complete before actually deleting
    setTimeout(() => {
      onDelete?.(node.id);
    }, 500); // Match animation duration
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, node.id);
  };



  return (
    <motion.div
      ref={ref}
      className="select-none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
      }}
      initial={{ scale: 0.6, opacity: 0.5, x: node.x, y: node.y }}
      animate={{ 
        scale: isDeleting ? 0 : 1, 
        opacity: isDeleting ? 0 : 1,
        width: diameter,
        height: diameter,
        rotate: isDeleting ? 180 : 0,
        x: node.x,
        y: node.y
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 25, 
        mass: 0.8,
        duration: isDeleting ? 0.5 : 0.4,
        // Disable position animation during drag for immediate response
        x: dragging ? { duration: 0 } : undefined,
        y: dragging ? { duration: 0 } : undefined
      }}
    >
      <motion.div
        className={`rounded-full backdrop-blur shadow-md border flex items-center justify-center text-center ${
          node.minimized 
            ? 'border-transparent' 
            : 'bg-[#fffaf3] border-[#e6dccb] px-4 py-4'
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
          type: "spring",
          stiffness: 400,
          damping: 30,
          mass: 0.6,
          duration: 0.5
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
            readOnly ? (
              <div className="text-slate-800 text-sm whitespace-pre-wrap break-words leading-snug text-center">
                {node.text}
              </div>
            ) : (
              <TextField
                variant="standard"
                placeholder="Type an idea…"
                value={node.text}
                onChange={(e) => onText(node.id, e.target.value)}
                onKeyDown={onKey}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                InputProps={{ 
                  disableUnderline: false,
                  style: { textAlign: 'center' }
                }}
                sx={{
                  '& .MuiInputBase-input': {
                    textAlign: 'center',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    cursor: 'text',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    textAlign: 'center',
                    opacity: 0.7,
                  }
                }}
                multiline
                fullWidth
              />
            )
          )}
        </motion.div>
      </motion.div>
      

    </motion.div>
  );
}
