"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NodeItem } from "./types";
import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { getNodeColor } from "@/utils/getNodeColor";
import { useAttention } from "./Attention";
import { useTheme, hexToRgba } from "./Themes";
import {
  getVisualDiameter,
  VISUAL_NODE_MINIMIZED_SIZE,
} from "@/utils/getVisualDiameter";
import { getDisplayContent } from "@/utils/getDisplayContent";

type Props = {
  node: NodeItem;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string, x: number, y: number, originalX?: number, originalY?: number) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId: string) => void;
  highlight?: boolean;
  screenToCanvas?: (screenX: number, screenY: number) => { x: number; y: number };
  onHoldStart?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onHoldMove?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onHoldEnd?: (details: { nodeId: string; clientX: number; clientY: number }) => void;
  onDoubleClickNode?: (id: string) => void;
  onHoverNode?: (id: string) => void;
  onHoverLeave?: (id: string) => void;
  onClickNode?: (id: string, event: React.MouseEvent) => void;
  distance?: number;
  isGlobalDragging?: boolean;
};

export default function NodeCard({
  node,
  onMove,
  onMoveEnd,
  onContextMenu,
  highlight,
  screenToCanvas,
  onHoldStart,
  onHoldMove,
  onHoldEnd,
  onDoubleClickNode,
  onHoverNode,
  onHoverLeave,
  onClickNode,
  distance = Number.POSITIVE_INFINITY,
  isGlobalDragging = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { focusedNodeId, setFocusedNode } = useAttention();
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const targetDiameterRaw = getVisualDiameter(
    node,
    Number.isFinite(distance) ? (distance as number) : undefined
  );
  const targetDiameter = Math.max(8, Math.round(targetDiameterRaw));
  const defaultBaseDiameter =
    (NodeVisualConfig.SIZE_LEVELS as Record<number, number>)[0] ??
    targetDiameter;
  const baseDiameterRaw = node.minimized
    ? VISUAL_NODE_MINIMIZED_SIZE
    : node.size ?? defaultBaseDiameter;
  const baseDiameter = Math.max(8, Math.round(baseDiameterRaw));
  const nodeColor = getNodeColor(node.type, theme);
  const minimizedFill = node.dotColor ?? nodeColor;
  const nodeBackgroundColor = node.minimized
    ? minimizedFill
    : hexToRgba(nodeColor, theme.node.backgroundAlpha);
  const baseBorderColor = node.minimized
    ? minimizedFill
    : hexToRgba(nodeColor, theme.node.borderAlpha);
  const isFocused = focusedNodeId === node.id;
  const activeBorderColor =
    highlight || isFocused
      ? theme.node.highlightStroke ?? minimizedFill
      : baseBorderColor;
  const attentionLevel = Number.isFinite(distance)
    ? Math.max(0, Math.floor(distance as number))
    : null;
  const opacityLevels =
    (theme.node.opacityLevels as Record<string | number, number> | undefined) ??
    (NodeVisualConfig.OPACITY_LEVELS as Record<string | number, number>);
  const defaultOpacity = opacityLevels.default ?? 0.6;
  const levelOpacity =
    attentionLevel !== null
      ? opacityLevels[attentionLevel] ?? defaultOpacity
      : defaultOpacity;
  const nodeOpacity =
    node.minimized || highlight || isFocused ? 1 : levelOpacity;
  const transition = NodeVisualConfig.TRANSITION;
  const nodeShadow =
    highlight || isFocused
      ? theme.node.shadow.highlight
      : theme.node.shadow.default;
  const textColor = node.minimized
    ? theme.node.textColor.minimized
    : theme.node.textColor.regular;
  const displayEmoji = node.emoji?.trim();
  const ariaLabel = node.full || node.text || "Idea node";
  const focusedLabelText =
    focusedNodeId === node.id
      ? (getDisplayContent(node, 0) || node.full || node.text || "")
      : "";
  const circleRadius = targetDiameter / 2;
  const fontSize =
    theme.node.label.fontSize ?? NodeVisualConfig.FOCUSED_LABEL.fontSize;
  const charWidthFactor =
    NodeVisualConfig.FOCUSED_LABEL.charWidthFactor ?? 0.55;
  const arcRadiusOffset =
    theme.node.label.arcRadiusOffset ??
    NodeVisualConfig.FOCUSED_LABEL.arcRadiusOffset ??
    12;
  const arcRadiusGap =
    theme.node.label.arcRadiusGap ??
    NodeVisualConfig.FOCUSED_LABEL.arcRadiusGap ??
    18;
  const svgPadding =
    theme.node.label.svgPadding ??
    NodeVisualConfig.FOCUSED_LABEL.svgPadding ??
    16;
  const labelTextColor =
    theme.node.label.textColor ??
    NodeVisualConfig.FOCUSED_LABEL.textColor ??
    "#111827";
  const labelLetterSpacing =
    theme.node.label.letterSpacing ??
    NodeVisualConfig.FOCUSED_LABEL.letterSpacing ??
    0;
  const backgroundBlur =
    theme.node.label.blur ??
    NodeVisualConfig.FOCUSED_LABEL.backgroundBlur ??
    8;
  const maxArcLength = Math.PI * circleRadius * 0.95;
  const charWidth = fontSize * charWidthFactor;
  const spaceWidth = fontSize * charWidthFactor;
  const ellipsis = "...";
  const ellipsisWidth = ellipsis.length * charWidth;
  const labelLines = useMemo(() => {
    if (!isFocused || !focusedLabelText) return [] as string[];
    const words = focusedLabelText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [] as string[];
    
    const lines: string[] = [];
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = word.length * charWidth;
      const nextWidth = currentLine
        ? currentWidth + spaceWidth + wordWidth
        : wordWidth;

      if (nextWidth <= maxArcLength) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
        currentWidth = nextWidth;
      } else if (!currentLine) {
        // word itself too long, hard truncate with ellipsis
        let truncated = "";
        let accumulatedWidth = 0;
        for (const ch of word) {
          const width = charWidth;
          if (accumulatedWidth + width + ellipsisWidth > maxArcLength) {
            break;
          }
          truncated += ch;
          accumulatedWidth += width;
        }
        lines.push(`${truncated}${ellipsis}`);
        currentLine = "";
        currentWidth = 0;
      } else {
        lines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    const firstLine = lines[0] ?? "";
    if (firstLine.length * charWidth > maxArcLength) {
      let truncated = "";
      let accumulatedWidth = 0;
      for (const ch of firstLine) {
        const width = charWidth;
        if (accumulatedWidth + width + ellipsisWidth > maxArcLength) {
          break;
        }
        truncated += ch;
        accumulatedWidth += width;
      }
      lines[0] = `${truncated}${ellipsis}`;
    }

    return lines.slice(0, 1);
  }, [charWidth, ellipsis, ellipsisWidth, focusedLabelText, isFocused, maxArcLength, spaceWidth]);
  const displayLines = useMemo(
    () => labelLines.slice().reverse(),
    [labelLines]
  );
  const lineHeight = fontSize + arcRadiusGap; // Use arcRadiusGap as line spacing
  const maxLineOffset =
    arcRadiusOffset + arcRadiusGap * Math.max(0, labelLines.length - 1);
  // Since we position the label container relative to the node's CENTER (50%),
  // we only need space above the center for the arcs and text
  const svgTopExtent = maxLineOffset + fontSize + svgPadding;
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

  const handleMouseEnter = () => {
    if (!dragging) {
      onHoverNode?.(node.id);
    }
  };

  const handleMouseLeave = () => {
    if (!dragging) {
      onHoverLeave?.(node.id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragging) return;
    e.stopPropagation();
    onClickNode?.(node.id, e);
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
        left: node.x,
        top: node.y,
        zIndex: highlight || isFocused ? 30 : 10,
        width: baseDiameter,
        height: baseDiameter,
        transformOrigin: "center center",
      }}
      layout={!(dragging || isGlobalDragging)}
      animate={{
        opacity: nodeOpacity,
        scale: node.minimized ? 1 : targetDiameter / baseDiameter,
      }}
      transition={{
        layout: {
          type: (dragging || isGlobalDragging) ? "tween" : "spring",
          duration: (dragging || isGlobalDragging) ? 0 : transition.duration,
          ease: (dragging || isGlobalDragging) ? "linear" : transition.ease,
          stiffness: 220,
          damping: 26,
        },
        opacity: { duration: 0.2 },
        scale: {
          type: (dragging || isGlobalDragging) ? "tween" : "spring",
          duration: (dragging || isGlobalDragging) ? 0 : transition.duration,
          ease: (dragging || isGlobalDragging) ? "linear" : transition.ease,
        },
      }}
    >
      <motion.div
        className="rounded-full backdrop-blur flex items-center justify-center text-center px-4 py-4"
        onMouseDown={startDrag}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!dragging) {
            setFocusedNode(node.id);
            onDoubleClickNode?.(node.id);
          }
        }}
        animate={{
          backgroundColor: nodeBackgroundColor,
          borderColor: activeBorderColor,
          borderWidth: node.minimized ? 3 : highlight || isFocused ? 3 : 2,
          borderStyle: "solid",
        }}
        transition={{
          duration: (dragging || isGlobalDragging) ? 0 : transition.duration,
          ease: (dragging || isGlobalDragging) ? "linear" : transition.ease,
        }}
        style={{
          width: "100%",
          height: "100%",
          boxShadow: nodeShadow,
          color: textColor,
        }}
      >
        <motion.div
          animate={{
            opacity: node.minimized ? 1 : 1,
            scale: node.minimized ? 1 : 1,
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
            bottom: `${circleRadius + NodeVisualConfig.FOCUSED_LABEL.offset}px`,
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
                      startOffset="50%"
                      textAnchor="middle"
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


