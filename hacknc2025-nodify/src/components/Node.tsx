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
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const pointerDownPositionRef = useRef({ x: 0, y: 0 });
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
  const backgroundAlphaBase =
    typeof theme.node.backgroundAlpha === "number"
      ? theme.node.backgroundAlpha
      : 0.3;
  const backgroundAlphaBoosted = Math.min(
    1,
    backgroundAlphaBase + (node.minimized ? 0 : 0.28)
  );
  const nodeBackgroundColor = node.minimized
    ? minimizedFill
    : hexToRgba(nodeColor, backgroundAlphaBoosted);
  const borderAlphaBase =
    typeof theme.node.borderAlpha === "number"
      ? theme.node.borderAlpha
      : 0.5;
  const borderAlphaBoosted = Math.min(1, borderAlphaBase + 0.2);
  const baseBorderColor = node.minimized
    ? minimizedFill
    : hexToRgba(nodeColor, borderAlphaBoosted);
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
  const opacityBoost = 0.22;
  const adjustedOpacity = Math.min(1, levelOpacity + opacityBoost);
  const nodeOpacity =
    node.minimized || highlight || isFocused ? 1 : adjustedOpacity;
  const transition = NodeVisualConfig.TRANSITION;
  const baseShadow =
    highlight || isFocused
      ? theme.node.shadow.highlight
      : theme.node.shadow.default;
  
  // 增强选中节点的高光效果
  const enhancedShadow = (highlight || isFocused) 
    ? `${baseShadow}, 0 0 0 2px ${hexToRgba(activeBorderColor, 0.5)}, 0 0 20px ${hexToRgba(activeBorderColor, 0.5)}`
    : baseShadow;
    
  const minimizedGlow =
    node.minimized && !(highlight || isFocused)
      ? [
          baseShadow,
          `0 0 0 2px ${hexToRgba(nodeColor, 0.4)}`,
          `0 0 18px ${hexToRgba(nodeColor, 0.28)}`,
        ].join(", ")
      : enhancedShadow;
  const nodeShadow = minimizedGlow;
  const textColor = node.minimized
    ? theme.node.textColor.minimized
    : theme.node.textColor.regular;
  const minimizedIndicatorColor = hexToRgba(
    theme.node.textColor.minimized,
    0.85
  );
  const minimizedIndicatorGlow = hexToRgba(
    theme.node.textColor.minimized,
    0.45
  );
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
  const onClickNodeRef = useRef(onClickNode);
  const dragPointerIdRef = useRef<number | null>(null);
  
  // Update refs when callbacks change
  onMoveRef.current = onMove;
  onMoveEndRef.current = onMoveEnd;
  onHoldStartRef.current = onHoldStart;
  onHoldMoveRef.current = onHoldMove;
  onHoldEndRef.current = onHoldEnd;
  onClickNodeRef.current = onClickNode;

  // Use ref to store current offset to avoid dependency issues
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  useEffect(() => {
    if (!isDragStarted) return;

    const pointerId = dragPointerIdRef.current;
    if (pointerId == null) return;

    // Capture current values in closure to avoid stale closure issues
    const currentDragStartPosition = dragStartPositionRef.current;
    const nodeElement = ref.current;
    const nodeId = node.id;
    
    const DRAG_THRESHOLD = 3; // pixels

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (e.pointerType !== "mouse") {
        e.preventDefault();
      }
      
      // Check if we've moved enough to be considered a drag
      if (!dragging) {
        const dx = e.clientX - pointerDownPositionRef.current.x;
        const dy = e.clientY - pointerDownPositionRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > DRAG_THRESHOLD) {
          setDragging(true);
        } else {
          return; // Not dragging yet, don't move node
        }
      }
      
      if (screenToCanvas) {
        const worldPos = screenToCanvas(e.clientX, e.clientY);
        onMoveRef.current(nodeId, worldPos.x - offsetRef.current.x, worldPos.y - offsetRef.current.y);
      } else {
        onMoveRef.current(nodeId, e.clientX - offsetRef.current.x, e.clientY - offsetRef.current.y);
      }
      onHoldMoveRef.current?.({ nodeId, clientX: e.clientX, clientY: e.clientY });
    };

    const finishDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (nodeElement) {
        try {
          nodeElement.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }
      
      // Always call onHoldEnd to cancel hold timer, regardless of whether we dragged
      onHoldEndRef.current?.({ nodeId, clientX: e.clientX, clientY: e.clientY });
      
      // Only call onMoveEnd if we actually dragged
      if (dragging) {
        let finalX: number;
        let finalY: number;
        if (screenToCanvas) {
          const worldPos = screenToCanvas(e.clientX, e.clientY);
          finalX = worldPos.x - offsetRef.current.x;
          finalY = worldPos.y - offsetRef.current.y;
        } else {
          finalX = e.clientX - offsetRef.current.x;
          finalY = e.clientY - offsetRef.current.y;
        }
        onMoveEndRef.current(nodeId, finalX, finalY, currentDragStartPosition.x, currentDragStartPosition.y);
      } else {
        // If we didn't drag, this was a click - trigger the click handler
        // Create a synthetic React MouseEvent-like object
        const syntheticEvent = {
          clientX: e.clientX,
          clientY: e.clientY,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          button: e.button,
          stopPropagation: () => {},
          preventDefault: () => {},
        } as React.MouseEvent;
        onClickNodeRef.current?.(nodeId, syntheticEvent);
      }
      
      dragPointerIdRef.current = null;
      setDragging(false);
      setIsDragStarted(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", finishDrag, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [isDragStarted, dragging, node.id, screenToCanvas]);

  const startDrag = (e: React.PointerEvent) => {
    // Don't start drag if clicking on TextField or input elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.MuiTextField-root')) {
      return;
    }
    
    if (!e.isPrimary && e.pointerType !== "mouse") {
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    // Store pointer down position to detect actual drag
    pointerDownPositionRef.current = { x: e.clientX, y: e.clientY };
    
    // Capture the ACTUAL current position immediately when drag starts
    // This ensures we get the real position even if node is mid-animation
    const currentPosition = { x: node.x, y: node.y };
    dragStartPositionRef.current = currentPosition;
    
    setIsDragStarted(true);
    dragPointerIdRef.current = e.pointerId;
    if (ref.current) {
      try {
        ref.current.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
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
        onPointerDown={startDrag}
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
          borderWidth: node.minimized ? 3 : highlight || isFocused ? 4 : 2,
          borderStyle: "solid",
          scale: highlight || isFocused ? 1.05 : 1,
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
          touchAction: "none",
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
          {node.minimized ? (
            <>
              <span
                aria-hidden
                className="block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: minimizedIndicatorColor,
                  boxShadow: `0 0 6px ${minimizedIndicatorGlow}`,
                }}
              />
              <span className="sr-only">{ariaLabel}</span>
            </>
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              aria-label={ariaLabel}
            >
              {displayEmoji ? (
                <span className="text-6xl leading-none">{displayEmoji}</span>
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
      {/* Focused label text as horizontal text below the node */}
      {isFocused && !node.minimized && focusedLabelText && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: transition.duration, ease: transition.ease }}
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: `calc(100% + 12px)`,
            zIndex: highlight || focusedNodeId === node.id ? 40 : 20,
          }}
        >
          <div
            className="px-3 py-2 rounded-lg backdrop-blur-md"
            style={{
              backgroundColor: hexToRgba(theme.canvas.background, 0.15),
              border: `1px solid ${hexToRgba(nodeColor, 0.3)}`,
              boxShadow: `0 2px 8px ${hexToRgba(nodeColor, 0.2)}`,
              maxWidth: '400px',
              width: 'max-content',
            }}
          >
            <div
              style={{
                color: labelTextColor,
                fontSize: fontSize,
                fontWeight: 500,
                letterSpacing: labelLetterSpacing,
                textAlign: 'center',
                lineHeight: 1.4,
                whiteSpace: 'normal',
                wordBreak: 'normal',
                overflowWrap: 'anywhere',
              }}
            >
              {focusedLabelText}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}


