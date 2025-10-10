"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { getNodeColor } from "@/utils/getNodeColor";
import { useAttention } from "./Attention";
import {
  getVisualDiameter,
  VISUAL_NODE_MINIMIZED_SIZE,
} from "@/utils/getVisualDiameter";
import { getDisplayContent } from "@/utils/getDisplayContent";

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
  onDoubleClickNode?: (id: string) => void;
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
  onDoubleClickNode,
  distance = Number.POSITIVE_INFINITY,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { setFocusedNode, focusedNodeId } = useAttention();
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const targetDiameter = getVisualDiameter(
    node,
    Number.isFinite(distance) ? (distance as number) : undefined
  );
  const defaultBaseDiameter =
    (NodeVisualConfig.SIZE_LEVELS as Record<number, number>)[0] ??
    targetDiameter;
  const baseDiameter = node.minimized
    ? VISUAL_NODE_MINIMIZED_SIZE
    : node.size ?? defaultBaseDiameter;
  const positionOffset = node.minimized
    ? 0
    : (baseDiameter - targetDiameter) / 2;
  const nodeColor = getNodeColor(node.type);
  const backgroundColor = node.minimized
    ? node.dotColor ?? nodeColor
    : toRgba(nodeColor, 0.18);
  const borderColor = node.minimized ? nodeColor : toRgba(nodeColor, 0.5);
  const isFocused = focusedNodeId === node.id;
  const transition = NodeVisualConfig.TRANSITION;
  const displayEmoji = node.emoji?.trim();
  const ariaLabel = node.full || node.text || "Idea node";
  const focusedLabelText =
    focusedNodeId === node.id
      ? (getDisplayContent(node, 0) || node.full || node.text || "")
      : "";
  const circleRadius = targetDiameter / 2;
  const fontSize = NodeVisualConfig.FOCUSED_LABEL.fontSize;
  const charWidthFactor =
    NodeVisualConfig.FOCUSED_LABEL.charWidthFactor ?? 0.55;
  const arcRadiusOffset =
    NodeVisualConfig.FOCUSED_LABEL.arcRadiusOffset ?? 12;
  const arcRadiusGap = NodeVisualConfig.FOCUSED_LABEL.arcRadiusGap ?? 18;
  const svgPadding = NodeVisualConfig.FOCUSED_LABEL.svgPadding ?? 16;
  const labelTextColor = NodeVisualConfig.FOCUSED_LABEL.textColor ?? "#111827";
  const labelLetterSpacing =
    NodeVisualConfig.FOCUSED_LABEL.letterSpacing ?? 0;
  const backgroundOpacity = NodeVisualConfig.FOCUSED_LABEL.backgroundOpacity ?? 0.95;
  const backgroundBlur = NodeVisualConfig.FOCUSED_LABEL.backgroundBlur ?? 8;
  const labelLines = useMemo(() => {
    if (!isFocused || !focusedLabelText) return [] as string[];
    const words = focusedLabelText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [] as string[];
    
    // Calculate max width based on arc length for the curved layout
    const maxArcLength = Math.PI * circleRadius * 0.9; // Use 90% of semi-circle for safety
    const spaceWidth = fontSize * charWidthFactor;
    const lines: string[] = [];
    let currentWords: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      const wordWidth = Math.max(word.length, 1) * fontSize * charWidthFactor;
      const nextLength =
        currentWords.length === 0
          ? wordWidth
          : currentLength + spaceWidth + wordWidth;

      if (nextLength > maxArcLength && currentWords.length > 0) {
        lines.push(currentWords.join(" "));
        currentWords = [word];
        currentLength = wordWidth;
      } else {
        currentWords.push(word);
        currentLength = nextLength;
      }
    }

    if (currentWords.length > 0) {
      lines.push(currentWords.join(" "));
    }

    return lines;
  }, [charWidthFactor, circleRadius, focusedLabelText, fontSize, isFocused]);
  const displayLines = useMemo(
    () => labelLines.slice().reverse(),
    [labelLines]
  );
  const maxLineOffset =
    arcRadiusOffset + arcRadiusGap * Math.max(0, labelLines.length - 1);
  const lineHeight = fontSize + arcRadiusGap; // Use arcRadiusGap as line spacing
  const svgTopExtent = circleRadius + maxLineOffset + fontSize + svgPadding;
  const svgWidth = targetDiameter + svgPadding * 2;
  const svgHeight = svgTopExtent;
  const viewBox = `${-circleRadius - svgPadding} ${-svgTopExtent} ${svgWidth} ${svgTopExtent}`;

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
        left: node.x + positionOffset,
        top: node.y + positionOffset,
        zIndex: highlight || isFocused ? 30 : 10,
      }}
      initial={false}
      animate={{
        opacity: 1,
        width: targetDiameter,
        height: targetDiameter,
      }}
      transition={{
        type: dragging ? "tween" : "spring",
        ease: dragging ? "linear" : transition.ease,
        duration: dragging ? 0 : transition.duration,
        stiffness: 220,
        damping: 26,
        mass: 0.9,
        opacity: { duration: 0.2 },
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
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!dragging) {
            setFocusedNode(node.id);
            onDoubleClickNode?.(node.id);
          }
        }}
        animate={{
          backgroundColor,
          borderColor,
          borderWidth: node.minimized ? 0 : isFocused ? 3 : 2,
          borderStyle: "solid",
        }}
        transition={{
          duration: dragging ? 0 : transition.duration,
          ease: dragging ? "linear" : transition.ease,
        }}
        style={{
          width: "100%",
          height: "100%",
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
          {node.minimized ? null : (
            <div
              className="flex h-full w-full items-center justify-center"
              aria-label={ariaLabel}
            >
              {displayEmoji ? (
                <span className="text-2xl leading-none">{displayEmoji}</span>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full bg-slate-500/70"
                  />
                  <span className="sr-only">{ariaLabel}</span>
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
      {/* Focused label text curved along the node arc */}
      {isFocused && !node.minimized && labelLines.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: transition.duration, ease: transition.ease }}
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: `calc(100% + ${NodeVisualConfig.FOCUSED_LABEL.offset}px)`,
            zIndex: highlight || focusedNodeId === node.id ? 40 : 20,
          }}
        >
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={viewBox}
            style={{ overflow: "visible", display: "block" }}
            aria-hidden
          >
            <defs>
              <filter id={`${node.id}-label-blur`}>
                <feGaussianBlur in="SourceGraphic" stdDeviation={backgroundBlur} />
              </filter>
            </defs>
            
            {/* Curved arc background that wraps around all text lines */}
            {displayLines.length > 0 && (() => {
              const outerRadius = circleRadius + arcRadiusOffset + (labelLines.length - 1) * lineHeight + fontSize;
              const innerRadius = circleRadius + arcRadiusOffset - fontSize / 2;
              const bgPadding = 10;
              
              return (
                <path
                  d={`
                    M ${-circleRadius - bgPadding} ${-innerRadius}
                    A ${innerRadius} ${innerRadius} 0 0 1 ${circleRadius + bgPadding} ${-innerRadius}
                    L ${circleRadius + bgPadding} ${-outerRadius}
                    A ${outerRadius} ${outerRadius} 0 0 0 ${-circleRadius - bgPadding} ${-outerRadius}
                    Z
                  `}
                  fill={`rgba(249, 245, 215, ${backgroundOpacity})`}
                  filter={`url(#${node.id}-label-blur)`}
                  stroke="rgba(200, 200, 200, 0.3)"
                  strokeWidth="1"
                />
              );
            })()}
            
            {/* Render text lines on curved arcs, but keep text horizontal/readable */}
            {displayLines.map((line, index) => {
              const lineOffset = arcRadiusOffset + index * lineHeight;
              const pathRadius = circleRadius + lineOffset;
              const baselineY = -pathRadius;
              const pathId = `${node.id}-focus-arc-${labelLines.length - 1 - index}`;
              
              return (
                <React.Fragment key={pathId}>
                  {/* Define the arc path for this line */}
                  <path 
                    id={pathId} 
                    d={`M ${-circleRadius} ${baselineY} A ${pathRadius} ${pathRadius} 0 0 1 ${circleRadius} ${baselineY}`} 
                    fill="none" 
                  />
                  {/* Render text along the arc path */}
                  <text
                    fill={labelTextColor}
                    fontSize={fontSize}
                    style={{ letterSpacing: labelLetterSpacing, fontWeight: 500 }}
                  >
                    <textPath
                      xlinkHref={`#${pathId}`}
                      startOffset="0%"
                      textAnchor="start"
                      method="align"
                      spacing="auto"
                    >
                      {line}
                    </textPath>
                  </text>
                </React.Fragment>
              );
            })}
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}
