"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import NodeCard from "./Node";
import { DashboardParams, NodeItem } from "./types";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MinimizeRoundedIcon from "@mui/icons-material/MinimizeRounded";
import { Button, TextField } from "@mui/material";

type Props = {
  params: DashboardParams;
};

type NodeMap = Record<string, NodeItem>;

type InputOverlayState = {
  open: boolean;
  mode: "create-root" | "edit-node";
  position: { x: number; y: number } | null;
  targetNodeId: string | null;
};

type PreviewPlaceholder = {
  id: string;
  x: number;
  y: number;
  angle: number;
  size: number;
};

type NodePreviewState = {
  parentId: string | null;
  placeholders: PreviewPlaceholder[];
  anchor: { x: number; y: number } | null;
  holdStartClient: { x: number; y: number } | null;
  pointerClient: { x: number; y: number } | null;
};

const normalizeAngle = (angle: number) => {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized > Math.PI) normalized -= twoPi;
  if (normalized < -Math.PI) normalized += twoPi;
  return normalized;
};

const HOLD_DURATION_MS = 500;
const ROOT_HOLD_MOVE_THRESHOLD = 18;
const NODE_HOLD_MOVE_THRESHOLD = 24;
const PREVIEW_PLACEHOLDER_SIZE = 150;
const SWIPE_TRIGGER_DISTANCE = 70;
const SWIPE_ANGLE_TOLERANCE = Math.PI / 5;

export default function Canvas({ params }: Props) {
  const [nodes, setNodes] = useState<NodeMap>({});
  const [edges, setEdges] = useState<Array<[string, string]>>([]); // [parent, child]
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    originalX: number; 
    originalY: number; 
    type: 'canvas' | 'node'; 
    nodeId?: string 
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inputOverlay, setInputOverlay] = useState<InputOverlayState>({
    open: false,
    mode: "create-root",
    position: null,
    targetNodeId: null,
  });
  const [inputOverlayValue, setInputOverlayValue] = useState("");
  const [previewState, setPreviewState] = useState<NodePreviewState>({
    parentId: null,
    placeholders: [],
    anchor: null,
    holdStartClient: null,
    pointerClient: null,
  });
  
  // 视口状态：缩放和平移
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  
  const draggingNodesRef = useRef(new Set<string>());
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const rootHoldTimerRef = useRef<number | null>(null);
  const rootHoldActiveRef = useRef(false);
  const rootHoldStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const rootHoldWorldRef = useRef<{ x: number; y: number } | null>(null);
  const nodeHoldTimerRef = useRef<number | null>(null);
  const nodeHoldInfoRef = useRef<{ nodeId: string; startClient: { x: number; y: number }; startCanvas: { x: number; y: number } } | null>(null);

  const nextId = () => `n_${idRef.current++}`;

  const computeSize = (text: string) => {
    const len = text.trim().length;
    const w = 140 + len * 6; // 6px per char heuristic
    return Math.max(140, Math.min(w, 420));
  };

  // 屏幕坐标转换为canvas坐标
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: screenX, y: screenY };
    
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // 转换为世界坐标（考虑缩放和偏移）
    const worldX = (canvasX - offsetX) / scale;
    const worldY = (canvasY - offsetY) / scale;
    
    return { x: worldX, y: worldY };
  }, [offsetX, offsetY, scale]);

  // canvas坐标转换为屏幕坐标
  const cancelRootHold = useCallback(() => {
    if (rootHoldTimerRef.current !== null) {
      window.clearTimeout(rootHoldTimerRef.current);
      rootHoldTimerRef.current = null;
    }
    rootHoldActiveRef.current = false;
    rootHoldStartRef.current = null;
    rootHoldWorldRef.current = null;
  }, []);

  const closeInputOverlay = useCallback(() => {
    cancelRootHold();
    setInputOverlay({
      open: false,
      mode: "create-root",
      position: null,
      targetNodeId: null,
    });
    setInputOverlayValue("");
  }, [cancelRootHold]);

  const clearPreview = useCallback(() => {
    setPreviewState({
      parentId: null,
      placeholders: [],
      anchor: null,
      holdStartClient: null,
      pointerClient: null,
    });
  }, []);

  const cancelNodeHold = useCallback(() => {
    if (nodeHoldTimerRef.current !== null) {
      window.clearTimeout(nodeHoldTimerRef.current);
      nodeHoldTimerRef.current = null;
    }
    nodeHoldInfoRef.current = null;
  }, []);

  const handleInputOverlaySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputOverlay.open) return;
    const value = inputOverlayValue.trim();
    if (!value) return;

    if (inputOverlay.mode === "create-root" && inputOverlay.position) {
      const diameter = computeSize(value);
      const x = (inputOverlay.position.x ?? 0) - diameter / 2;
      const y = (inputOverlay.position.y ?? 0) - diameter / 2;
      addNodeAt(x, y, null, value);
      closeInputOverlay();
    }
  };



  // Check if two nodes are colliding
  const checkCollision = (node1: { x: number; y: number; size?: number }, node2: { x: number; y: number; size?: number }) => {
    const size1 = node1.size || 160;
    const size2 = node2.size || 160;
    const minDistance = (size1 + size2) / 2 + 10; // Add 10px buffer
    
    const dx = node1.x + size1/2 - (node2.x + size2/2);
    const dy = node1.y + size1/2 - (node2.y + size2/2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < minDistance;
  };

  const addNodeAt = (x: number, y: number, parentId?: string | null, text = "") => {
    const id = nextId();
    
    // Ensure reasonable default position if canvas size not available
    const safeX = x || 200;
    const safeY = y || 200;
    
    const node: NodeItem = {
      id,
      x: safeX,
      y: safeY,
      text,
      parentId: parentId ?? null,
      children: [],
      size: computeSize(text),
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    if (parentId) setEdges((e) => [...e, [parentId, id]]);
    setSelectedId(id);
    return id;
  };

  // 鼠标滚轮缩放事件
  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    // 获取画布相对坐标
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算缩放因子
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.2, Math.min(3, scale * scaleFactor));
    
    // 计算以鼠标位置为中心的缩放偏移
    const scaleChange = newScale / scale;
    const newOffsetX = mouseX - (mouseX - offsetX) * scaleChange;
    const newOffsetY = mouseY - (mouseY - offsetY) * scaleChange;
    
    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // 鼠标中键平移事件
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // 中键
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
      // 阻止浏览器默认的中键滚动行为
      document.body.style.overflow = 'hidden';
      return;
    }

    if (e.button === 0) {
      const hasNodes = Object.keys(nodes).length > 0;
      if (!hasNodes && !inputOverlay.open) {
        if (rootHoldTimerRef.current !== null) {
          window.clearTimeout(rootHoldTimerRef.current);
        }
        rootHoldActiveRef.current = true;
        rootHoldStartRef.current = { clientX: e.clientX, clientY: e.clientY };
        rootHoldWorldRef.current = screenToCanvas(e.clientX, e.clientY);
        rootHoldTimerRef.current = window.setTimeout(() => {
          rootHoldTimerRef.current = null;
          if (!rootHoldActiveRef.current) return;
          const position = rootHoldWorldRef.current ?? screenToCanvas(e.clientX, e.clientY);
          setInputOverlay({
            open: true,
            mode: "create-root",
            position,
            targetNodeId: null,
          });
          setInputOverlayValue("");
          rootHoldActiveRef.current = false;
        }, HOLD_DURATION_MS);
      }
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (rootHoldActiveRef.current && rootHoldStartRef.current) {
      const dx = e.clientX - rootHoldStartRef.current.clientX;
      const dy = e.clientY - rootHoldStartRef.current.clientY;
      if (Math.hypot(dx, dy) > ROOT_HOLD_MOVE_THRESHOLD) {
        cancelRootHold();
      }
    }

    if (isPanning && panStart) {
      setOffsetX(e.clientX - panStart.x);
      setOffsetY(e.clientY - panStart.y);
    }
  };

  const onCanvasMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) { // 中键
      setIsPanning(false);
      setPanStart(null);
      document.body.style.overflow = '';
    }
    if (e.button === 0) {
      cancelRootHold();
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    // 检查是否点击了节点
    const target = e.target as HTMLElement;
    if (target.closest('.node-card')) {
      return; // 点击在节点上，忽略
    }
    
    // Hide context menu if visible
    setContextMenu(null);
    
    // Clear selection on canvas click
    setSelectedId(null);
  };

  const onCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 检查是否右键点击了节点
    const target = e.target as HTMLElement;
    if (target.closest('.node-card')) {
      return; // 右键点击在节点上，忽略
    }
    
    // 防止在平移过程中触发右键菜单
    if (isPanning) return;
    
    // Calculate menu position with boundary checking
    const menuWidth = 180;
    const menuHeight = 60; // Approximate height for single item menu
    const padding = 10;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust x if menu would go off right edge
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Adjust y if menu would go off bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    // Ensure menu doesn't go off left or top edges
    x = Math.max(padding, x);
    y = Math.max(padding, y);
    
    setContextMenu({ 
      x, 
      y, 
      originalX: e.clientX, 
      originalY: e.clientY, 
      type: 'canvas' 
    });
  };

  const onGenerateNewNode = () => {
    if (!contextMenu || !canvasRef.current) {
      return;
    }
    
    // 将右键点击的屏幕坐标转换为世界坐标
    const worldPos = screenToCanvas(contextMenu.originalX, contextMenu.originalY);
    
    // Find non-colliding position
    const id = nextId();
    const nodeSize = computeSize("");
    
    // 直接使用世界坐标，不做碰撞检测
    const position = { x: worldPos.x, y: worldPos.y };
    
    // Create node without draft status (already confirmed)
    const node: NodeItem = {
      id,
      x: position.x,
      y: position.y,
      text: "",
      parentId: null,
      children: [],
      size: nodeSize,
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    setSelectedId(id);
    
    setContextMenu(null); // Hide menu after action
  };

  // 用于跟踪动画帧的引用
  const animationFrameRef = useRef<number | null>(null);

  // 重置相机到初始位置
  const onResetCamera = useCallback(() => {
    // 取消之前可能存在的动画
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 使用平滑动画重置相机
    const startScale = scale;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;
    const duration = 500; // 动画持续时间（毫秒）
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用easeOutCubic缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const newScale = startScale + (1 - startScale) * easeProgress;
      const newOffsetX = startOffsetX + (0 - startOffsetX) * easeProgress;
      const newOffsetY = startOffsetY + (0 - startOffsetY) * easeProgress;
      
      // 批量更新状态
      setScale(newScale);
      setOffsetX(newOffsetX);
      setOffsetY(newOffsetY);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    setContextMenu(null); // Hide menu after action
  }, [scale, offsetX, offsetY]);

  const executingActionsRef = useRef(new Set<string>());
  
  const handleNodeMenuAction = (action: string, nodeId: string) => {
    const actionKey = `${action}-${nodeId}`;
    
    // Prevent double execution
    if (executingActionsRef.current.has(actionKey)) {
      return;
    }
    
    executingActionsRef.current.add(actionKey);
    setContextMenu(null);
    
    // Clear the action key after a short delay
    setTimeout(() => {
      executingActionsRef.current.delete(actionKey);
    }, 1000);
    
    switch (action) {
      case 'expand':
        console.log('Expand action triggered for node:', nodeId);
        // Directly call the functions - they are stable due to useCallback
        onGenerate(nodeId);
        break;
      case 'minimize':
        onMinimize?.(nodeId);
        break;
      case 'delete':
        onDelete?.(nodeId);
        break;
    }
  };

  const onNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate menu position with boundary checking
    const menuWidth = 180;
    const menuHeight = 120; // Approximate height of menu
    const padding = 10;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust x if menu would go off right edge
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Adjust y if menu would go off bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    // Ensure menu doesn't go off left or top edges
    x = Math.max(padding, x);
    y = Math.max(padding, y);
    
    setContextMenu({ 
      x, 
      y, 
      originalX: e.clientX, 
      originalY: e.clientY, 
      type: 'node', 
      nodeId 
    });
  }, []);

  const onMove = useCallback((id: string, x: number, y: number) => {
    if (previewState.parentId === id) {
      return;
    }
    // Track dragging nodes for smooth line animations (only add if not already dragging this node)
    if (!draggingNodesRef.current.has(id)) {
      if (draggingNodesRef.current.size === 0) {
        setIsDragging(true);
      }
      draggingNodesRef.current.add(id);
    }
    
    // During drag, just update position without constraint - let user drag freely
    // Constraints will be applied in onMoveEnd
    setNodes((prev) => {
      const node = prev[id];
      if (!node || (node.x === x && node.y === y)) {
        return prev; // No change needed
      }
      
      return {
        ...prev,
        [id]: { ...node, x, y }
      };
    });
  }, [previewState.parentId]);

  const onMoveEnd = useCallback((id: string, x: number, y: number, originalX?: number, originalY?: number) => {
    if (previewState.parentId === id) {
      draggingNodesRef.current.delete(id);
      if (draggingNodesRef.current.size === 0) {
        setIsDragging(false);
      }
      return;
    }
    setNodes((currentNodes) => {
      const node = currentNodes[id];
      if (!node) return currentNodes;
      
      const nodeSize = node.size ?? 160;
      
      // No canvas boundary constraints - allow nodes to move freely anywhere
      const targetPosition = { x, y, size: nodeSize };
      
      // Check for collisions with other nodes
      let hasCollision = false;
      for (const otherNode of Object.values(currentNodes)) {
        if (otherNode.id === id || otherNode.minimized) continue;
        
        if (checkCollision(targetPosition, otherNode)) {
          hasCollision = true;
          break;
        }
      }
      
      if (hasCollision && originalX !== undefined && originalY !== undefined) {
        // Collision detected - first move to target position to show the "impact"
        const impactUpdate = {
          ...currentNodes,
          [id]: { ...currentNodes[id], x, y }
        };
        
        // Validate and find safe bounce-back position
        const originalPosition = { x: originalX, y: originalY, size: nodeSize };
        let bounceBackPosition = { x: originalX, y: originalY };
        
        // Check if original position is still collision-free
        let originalPositionHasCollision = false;
        for (const otherNode of Object.values(currentNodes)) {
          if (otherNode.id === id || otherNode.minimized) continue;
          
          if (checkCollision(originalPosition, otherNode)) {
            originalPositionHasCollision = true;
            break;
          }
        }
        
        // If original position now has collision, find a nearby safe position
        if (originalPositionHasCollision) {
          // Find a new safe position using spiral pattern
          let testX = originalX;
          let testY = originalY;
          let attempts = 0;
          const maxAttempts = 50;
          
          while (attempts < maxAttempts) {
            const testNode = { x: testX, y: testY, size: nodeSize };
            let hasTestCollision = false;
            
            // Check against all other nodes
            for (const otherNode of Object.values(currentNodes)) {
              if (otherNode.id === id || otherNode.minimized) continue;
              
              if (checkCollision(testNode, otherNode)) {
                hasTestCollision = true;
                break;
              }
            }
            
            if (!hasTestCollision) {
              // No boundary constraints - use position as is
              bounceBackPosition = { x: testX, y: testY };
              break;
            }
            
            // Try a new position in a spiral pattern
            const angle = (attempts * 0.5) % (2 * Math.PI);
            const radius = 20 + attempts * 5;
            testX = originalX + Math.cos(angle) * radius;
            testY = originalY + Math.sin(angle) * radius;
            attempts++;
          }
          
          // If no non-colliding position found, use original position anyway
          if (attempts >= maxAttempts) {
            bounceBackPosition = { x: originalX, y: originalY };
          }
        }
        
        // Then animate back to validated bounce-back position
        setTimeout(() => {
          setNodes((prev) => ({
            ...prev,
            [id]: { ...prev[id], x: bounceBackPosition.x, y: bounceBackPosition.y }
          }));
        }, 50); // Short delay to show the impact position before bouncing back
        
        return impactUpdate;
      } else if (!hasCollision) {
        // No collision, finalize the move - no boundary constraints
        return { ...currentNodes, [id]: { ...currentNodes[id], x, y } };
      }
      
      // If collision but no original position provided, just keep current position
      return currentNodes;
    });
    
    // Remove node from dragging set and clear state when all drags complete
    draggingNodesRef.current.delete(id);
    if (draggingNodesRef.current.size === 0) {
      setIsDragging(false);
    }
  }, [previewState.parentId]);

  const onDelete = useCallback((id: string) => {
    setNodes((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    // Also remove any edges connected to this node
    setEdges((prev) => prev.filter(([parent, child]) => parent !== id && child !== id));
    // Clear selection if this node was selected
    setSelectedId((current) => current === id ? null : current);
    setPreviewState((prev) => {
      if (prev.parentId !== id) return prev;
      return {
        parentId: null,
        placeholders: [],
        anchor: null,
        holdStartClient: null,
        pointerClient: null,
      };
    });
  }, []);

  const onMinimize = useCallback((id: string) => {
    setNodes((prev) => {
      const node = prev[id];
      if (!node) return prev;
      
      if (node.minimized) {
        // Restore the node
        return { 
          ...prev, 
          [id]: { 
            ...node, 
            minimized: false,
            dotColor: undefined
          } 
        };
      } else {
        // Minimize the node
        const colors = ['#3b82f6', '#eab308', '#22c55e', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        return { 
          ...prev, 
          [id]: { 
            ...node, 
            minimized: true, 
            dotColor: randomColor 
          } 
        };
      }
    });
  }, []);

  // 重写的智能散布算法
  const arrangeAroundSmart = useCallback((centerX: number, centerY: number, childCount: number, parentId: string) => {
    const positions: { x: number; y: number }[] = [];
    
    // 如果没有子节点，直接返回
    if (childCount === 0) return positions;
    
    // 获取所有现有节点（排除父节点和最小化节点）
    const existingNodes = Object.values(nodes).filter(node => 
      node.id !== parentId && !node.minimized
    );
    

    
    // 检查两点之间的距离
    const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
      return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    };
    
    // 检查位置是否安全（不与其他节点重叠）
    const isSafePosition = (x: number, y: number) => {
      const minSafeDistance = 180; // 节点之间的最小安全距离
      
      // 检查与现有节点的距离（现有节点的坐标需要转换为中心点）
      for (const existing of existingNodes) {
        const existingCenterX = existing.x + (existing.size || 160) / 2;
        const existingCenterY = existing.y + (existing.size || 160) / 2;
        if (getDistance(x, y, existingCenterX, existingCenterY) < minSafeDistance) {
          return false;
        }
      }
      
      // 检查与已经安排的子节点位置的距离（positions中存储的是中心点坐标）
      for (const pos of positions) {
        if (getDistance(x, y, pos.x, pos.y) < minSafeDistance) {
          return false;
        }
      }
      
      return true;
    };
    
    // 生成候选位置的函数
    const generateCandidatePositions = (radius: number, angleCount: number) => {
      const candidates: { x: number; y: number }[] = [];
      for (let i = 0; i < angleCount; i++) {
        const angle = (2 * Math.PI * i) / angleCount;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        candidates.push({ x, y });
      }
      return candidates;
    };
    
    // 为每个子节点找位置
    for (let nodeIndex = 0; nodeIndex < childCount; nodeIndex++) {
      let positioned = false;
      
      // 尝试不同的半径层级
      for (let radiusLevel = 0; radiusLevel < 5 && !positioned; radiusLevel++) {
        const radius = 150 + radiusLevel * 50; // 150, 200, 250, 300, 350
        const angleCount = Math.max(8, childCount + radiusLevel * 4); // 增加角度选项
        
        const candidates = generateCandidatePositions(radius, angleCount);
        
        // 在候选位置中找到第一个安全的位置
        for (const candidate of candidates) {
          if (isSafePosition(candidate.x, candidate.y)) {
            positions.push(candidate);
            positioned = true;
            break;
          }
        }
      }
      
      // 如果所有尝试都失败，使用默认位置
      if (!positioned) {
        const fallbackAngle = (2 * Math.PI * nodeIndex) / childCount;
        const fallbackRadius = 200;
        const fallbackX = centerX + fallbackRadius * Math.cos(fallbackAngle);
        const fallbackY = centerY + fallbackRadius * Math.sin(fallbackAngle);
        positions.push({ x: fallbackX, y: fallbackY });
      }
    }
    
    return positions;
  }, [nodes]);


  const onGenerate = useCallback(
    async (id: string) => {
      console.log('onGenerate function called with id:', id);
      // Prevent double generation for the same node
      if (generatingNodesRef.current.has(id)) {
        console.log('Generation already in progress for:', id);
        return;
      }
      
      console.log('Starting generation for:', id);
      generatingNodesRef.current.add(id);
      
      // Get node data using functional state access
      let nodeData: NodeItem | undefined;
      await new Promise<void>((resolve) => {
        setNodes((currentNodes) => {
          nodeData = currentNodes[id];
          resolve();
          return currentNodes; // No change
        });
      });
      
      if (!nodeData || !nodeData.text.trim()) {
        generatingNodesRef.current.delete(id);
        return;
      }
      
      try {
        const prompt = `Given the parent idea: "${nodeData.text.trim()}"\nGenerate ${params.nodeCount} concise sub-ideas (${params.phraseLength} chars each). Return as a JSON array of strings.`;
        let items: string[] = [];
        
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
        
        if (!items || items.length === 0) {
          generatingNodesRef.current.delete(id);
          return;
        }

        const childEdges: [string, string][] = [];
        
        // Calculate smart positions for child nodes
        // 使用父节点的中心点作为起始坐标
        const parentCenterX = nodeData.x + (nodeData.size || 160) / 2;
        const parentCenterY = nodeData.y + (nodeData.size || 160) / 2;
        
        const positions = arrangeAroundSmart(parentCenterX, parentCenterY, items.length, id);
        
        // Update nodes with new children
        setNodes((prev) => {
          const updated = { ...prev };
          const parent = updated[id];
          if (!parent) return prev;
          
          const childIds: string[] = [];
          items.forEach((text, idx) => {
            const childId = nextId();
            const finalPosition = positions[idx];
            const childSize = computeSize(text);
            const finalX = finalPosition ? finalPosition.x - childSize / 2 : (nodeData?.x || 0);
            const finalY = finalPosition ? finalPosition.y - childSize / 2 : (nodeData?.y || 0);
            
            updated[childId] = {
              id: childId,
              text,
              // 子节点位置应该是中心点减去节点尺寸的一半
              x: finalX,
              y: finalY,
              parentId: id,
              children: [],
              size: childSize,
            };
            childIds.push(childId);
            childEdges.push([id, childId]);
          });
          updated[id] = { ...parent, children: [...parent.children, ...childIds], expanded: true };
          return updated;
        });
        
        setEdges((e) => [...e, ...childEdges]);
        
      } catch (error) {
        console.error('Error in generation:', error);
      } finally {
        // Always clean up the generating flag
        generatingNodesRef.current.delete(id);
      }
    },
    [params.nodeCount, params.phraseLength, params.temperature, arrangeAroundSmart]
  );

  const generatingNodesRef = useRef(new Set<string>());

  const commitPreview = useCallback(
    (nodeId: string) => {
      if (generatingNodesRef.current.has(nodeId)) {
        return;
      }
      clearPreview();
      cancelNodeHold();
      onGenerate(nodeId);
    },
    [clearPreview, cancelNodeHold, onGenerate]
  );

  useEffect(() => {
    if (!inputOverlay.open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeInputOverlay();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [inputOverlay.open, closeInputOverlay]);

  useEffect(() => {
    if (!previewState.parentId) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (previewState.parentId) {
          commitPreview(previewState.parentId);
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelNodeHold();
        clearPreview();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewState.parentId, commitPreview, cancelNodeHold, clearPreview]);



  // Close context menu when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenu) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + 0 重置相机
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        onResetCamera();
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    // 添加全局键盘快捷键监听
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, onResetCamera]);

  useEffect(() => cancelNodeHold, [cancelNodeHold]);

  // 全局鼠标事件处理（平移功能）
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning && panStart) {
        setOffsetX(e.clientX - panStart.x);
        setOffsetY(e.clientY - panStart.y);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        document.body.style.overflow = '';
      }
      cancelRootHold();
    };

    if (isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart, cancelRootHold]);

  // 组件卸载时清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  
  // Add ref to track which nodes are currently generating to prevent double execution
  const openPreviewForNode = useCallback(
    (nodeId: string, holdStart: { x: number; y: number } | null) => {
      if (params.nodeCount <= 0) {
        return;
      }
      const parentNode = nodes[nodeId];
      if (!parentNode || parentNode.minimized) {
        return;
      }

      const parentSize = parentNode.size ?? 160;
      const anchorX = parentNode.x + parentSize / 2;
      const anchorY = parentNode.y + parentSize / 2;

      const targetPositions = arrangeAroundSmart(anchorX, anchorY, params.nodeCount, nodeId);
      if (!targetPositions.length) {
        setPreviewState({
          parentId: nodeId,
          placeholders: [],
          anchor: { x: anchorX, y: anchorY },
          holdStartClient: holdStart,
          pointerClient: holdStart,
        });
        return;
      }

      const placeholders = targetPositions.map((center, index) => {
        const size = Math.max(120, Math.min(PREVIEW_PLACEHOLDER_SIZE, parentSize + 10));
        return {
          id: `${nodeId}-preview-${index}`,
          x: center.x - size / 2,
          y: center.y - size / 2,
          angle: Math.atan2(center.y - anchorY, center.x - anchorX),
          size,
        } satisfies PreviewPlaceholder;
      });

      setPreviewState({
        parentId: nodeId,
        placeholders,
        anchor: { x: anchorX, y: anchorY },
        holdStartClient: holdStart,
        pointerClient: holdStart,
      });
      setSelectedId(nodeId);
    },
    [nodes, params.nodeCount, arrangeAroundSmart]
  );

  const handleNodeHoldStart = useCallback(
    ({ nodeId, clientX, clientY }: { nodeId: string; clientX: number; clientY: number }) => {
      if (inputOverlay.open) return;
      cancelNodeHold();
      clearPreview();
      const startCanvas = screenToCanvas(clientX, clientY);
      nodeHoldInfoRef.current = {
        nodeId,
        startClient: { x: clientX, y: clientY },
        startCanvas,
      };
      nodeHoldTimerRef.current = window.setTimeout(() => {
        nodeHoldTimerRef.current = null;
        const info = nodeHoldInfoRef.current;
        if (!info || info.nodeId !== nodeId) return;
        openPreviewForNode(nodeId, info.startClient);
      }, HOLD_DURATION_MS);
    },
    [cancelNodeHold, clearPreview, openPreviewForNode, inputOverlay.open, screenToCanvas]
  );

  const handleNodeHoldMove = ({ nodeId, clientX, clientY }: { nodeId: string; clientX: number; clientY: number }) => {
    const holdInfo = nodeHoldInfoRef.current;
    if (holdInfo && holdInfo.nodeId === nodeId && nodeHoldTimerRef.current !== null) {
      const dx = clientX - holdInfo.startClient.x;
      const dy = clientY - holdInfo.startClient.y;
      if (Math.hypot(dx, dy) > NODE_HOLD_MOVE_THRESHOLD) {
        cancelNodeHold();
      }
    }

    setPreviewState((prev) => {
      if (prev.parentId !== nodeId) return prev;
      if (prev.pointerClient && prev.pointerClient.x === clientX && prev.pointerClient.y === clientY) {
        return prev;
      }
      return {
        ...prev,
        pointerClient: { x: clientX, y: clientY },
      };
    });
  };

  
  const handleNodeHoldEnd = useCallback(
    ({ nodeId, clientX, clientY }: { nodeId: string; clientX: number; clientY: number }) => {
      if (previewState.parentId === nodeId && previewState.anchor) {
        const releaseCanvas = screenToCanvas(clientX, clientY);
        const dx = releaseCanvas.x - previewState.anchor.x;
        const dy = releaseCanvas.y - previewState.anchor.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= SWIPE_TRIGGER_DISTANCE) {
          const swipeAngle = Math.atan2(dy, dx);
          const matched = previewState.placeholders.some((placeholder) => {
            const diff = Math.abs(normalizeAngle(swipeAngle - placeholder.angle));
            return diff <= SWIPE_ANGLE_TOLERANCE;
          });

          if (matched) {
            commitPreview(nodeId);
            return;
          }
        }
      }

      if (nodeHoldInfoRef.current?.nodeId === nodeId) {
        cancelNodeHold();
      }
      if (previewState.parentId === nodeId) {
        clearPreview();
      }
    },
    [previewState, screenToCanvas, commitPreview, cancelNodeHold, clearPreview]
  );

  const lines = useMemo(() => {
    const pairs = edges
      .map(([p, c]) => {
        const parent = nodes[p];
        const child = nodes[c];
        if (!parent || !child) return null;
        
        // 确保使用正确的节点尺寸计算中心点
        const parentSize = parent.size ?? 160;
        const childSize = child.size ?? 160; // 使用相同的默认尺寸
        
        const pX = parent.x + parentSize / 2;
        const pY = parent.y + parentSize / 2;
        const cX = child.x + childSize / 2;
        const cY = child.y + childSize / 2;
        
        return { pX, pY, cX, cY, key: `${p}-${c}` };
      })
      .filter(Boolean) as Array<{ pX: number; pY: number; cX: number; cY: number; key: string }>;
    return pairs;
  }, [edges, nodes]);

  // 生成网格背景
  const gridSize = 50; // 基础网格大小
  const gridPattern = useMemo(() => {
    // 计算适应缩放的网格大小
    let actualGridSize = gridSize;
    
    // 当缩放过小时，使用更大的网格
    while (actualGridSize * scale < 20 && actualGridSize < 200) {
      actualGridSize *= 2;
    }
    
    // 当缩放过大时，使用更小的网格
    while (actualGridSize * scale > 200 && actualGridSize > 12.5) {
      actualGridSize /= 2;
    }
    
    const scaledGridSize = actualGridSize * scale;
    const adjustedOffsetX = (offsetX % scaledGridSize + scaledGridSize) % scaledGridSize;
    const adjustedOffsetY = (offsetY % scaledGridSize + scaledGridSize) % scaledGridSize;
    
    // 根据缩放级别调整网格透明度 - 增强可见性
    const lineOpacity = Math.min(Math.max(0.5, scale * 0.3), 0.8);
    const dotOpacity = Math.min(Math.max(0.4, scale * 0.4), 0.7);
    
    return {
      size: scaledGridSize,
      offsetX: adjustedOffsetX,
      offsetY: adjustedOffsetY,
      lineOpacity,
      dotOpacity
    };
  }, [scale, offsetX, offsetY]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[calc(100vh-64px)] overflow-hidden"
      onClick={onCanvasClick}
      onContextMenu={onCanvasContextMenu}
      onWheel={onCanvasWheel}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      style={{
        cursor: isPanning ? 'grabbing' : 'default',
        background: `
          linear-gradient(90deg, transparent ${gridPattern.size - 1}px, rgba(156, 163, 175, ${gridPattern.lineOpacity}) 1px),
          linear-gradient(transparent ${gridPattern.size - 1}px, rgba(156, 163, 175, ${gridPattern.lineOpacity}) 1px),
          linear-gradient(135deg, #f7f2e8 0%, #f3eadb 100%)
        `,
        backgroundSize: `${gridPattern.size}px ${gridPattern.size}px, ${gridPattern.size}px ${gridPattern.size}px, 100% 100%`,
        backgroundPosition: `${gridPattern.offsetX}px ${gridPattern.offsetY}px, ${gridPattern.offsetX}px ${gridPattern.offsetY}px, 0 0`
      }}
    >
      {/* 变换容器 - 应用缩放和平移 */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '0 0'
        }}
        onClick={onCanvasClick}
        onContextMenu={onCanvasContextMenu}
      >
        <svg 
          className="absolute inset-0 pointer-events-none" 
          width="100%" 
          height="100%"
          style={{ 
            overflow: 'visible'
          }}
        >
          {/* 中心点原点标记 */}
          <circle
            cx={0}
            cy={0}
            r={6}
            fill="rgba(239, 68, 68, 0.8)"
            stroke="rgba(239, 68, 68, 1)"
            strokeWidth={2}
            style={{ 
              vectorEffect: 'non-scaling-stroke' // 保持圆圈大小不受缩放影响
            }}
          />
          <circle
            cx={0}
            cy={0}
            r={2}
            fill="white"
          />
          
          {lines.map(({ pX, pY, cX, cY, key }) => (
            <motion.line
              key={key}
              animate={{
                x1: pX,
                y1: pY,
                x2: cX,
                y2: cY,
              }}
              initial={{
                x1: pX,
                y1: pY,
                x2: cX,
                y2: cY,
              }}
              transition={
                isDragging
                  ? { duration: 0 }  // Immediate response during drag
                  : {
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      mass: 0.8,
                      duration: 0.4,
                    }
              }
              stroke="#94a3b8"
              strokeWidth={1.5}
              style={{ 
                vectorEffect: 'non-scaling-stroke' // 保持线条粗细不受缩放影响
              }}
            />
          ))}
          {previewState.anchor &&
            previewState.placeholders.map((placeholder) => {
              const targetX = placeholder.x + placeholder.size / 2;
              const targetY = placeholder.y + placeholder.size / 2;
              return (
                <motion.line
                  key={`${placeholder.id}-preview-line`}
                  x1={previewState.anchor!.x}
                  y1={previewState.anchor!.y}
                  x2={targetX}
                  y2={targetY}
                  stroke="#94a3b8"
                  strokeWidth={1.2}
                  strokeDasharray="6 6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  style={{ vectorEffect: 'non-scaling-stroke' }}
                />
              );
            })}
        </svg>

        {previewState.placeholders.map((placeholder) => (
          <motion.div
            key={placeholder.id}
            className="absolute pointer-events-none rounded-full border border-dashed border-slate-400/60 bg-white/20 backdrop-blur-md flex items-center justify-center text-[11px] uppercase tracking-wider text-slate-500"
            style={{
              left: placeholder.x,
              top: placeholder.y,
              width: placeholder.size,
              height: placeholder.size,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 20, mass: 0.7 }}
          >
            <span className="opacity-70">Preview</span>
          </motion.div>
        ))}

        {Object.values(nodes).map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            onMove={onMove}
            onMoveEnd={onMoveEnd}
            onMinimize={onMinimize}
            onContextMenu={onNodeContextMenu}
            highlight={selectedId === n.id}
            screenToCanvas={screenToCanvas}
            onHoldStart={handleNodeHoldStart}
            onHoldMove={handleNodeHoldMove}
            onHoldEnd={handleNodeHoldEnd}
          />
        ))}
      </div>

      {previewState.parentId && (
        <div className="pointer-events-none absolute inset-0 bg-slate-950/12 transition-opacity duration-150" />
      )}

      {/* Context Menu - Render in Portal for consistent positioning */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'canvas' ? (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={onGenerateNewNode}
              >
                <span className="text-blue-500">✨</span>
                Generate New Node
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={onResetCamera}
              >
                <span className="text-green-500">🎯</span>
                Reset Camera View
              </button>
            </>
          ) : contextMenu.type === 'node' && contextMenu.nodeId ? (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={() => handleNodeMenuAction('expand', contextMenu.nodeId!)}
              >
                <AutoAwesomeRoundedIcon fontSize="small" className="text-blue-500" />
                {nodes[contextMenu.nodeId]?.parentId ? 'Expand Sub-ideas' : 'Expand with AI'}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={() => handleNodeMenuAction('minimize', contextMenu.nodeId!)}
              >
                <MinimizeRoundedIcon fontSize="small" className="text-yellow-500" />
                {nodes[contextMenu.nodeId]?.minimized ? 'Restore' : 'Minimize'}
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => handleNodeMenuAction('delete', contextMenu.nodeId!)}
              >
                <CloseRoundedIcon fontSize="small" className="text-red-500" />
                Delete Node
              </button>
            </>
          ) : null}
        </div>,
        document.body
      )}

      {inputOverlay.open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeInputOverlay}
          />
          <div className="relative z-10 w-full max-w-md px-6">
            <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">
                What&apos;s the core idea?
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Hold anywhere on the canvas to spark your first thought.
              </p>
              <form onSubmit={handleInputOverlaySubmit} className="space-y-4">
                <TextField
                  autoFocus
                  multiline
                  minRows={2}
                  label="Idea"
                  placeholder="Describe the concept you want to explore…"
                  value={inputOverlayValue}
                  onChange={(event) => setInputOverlayValue(event.target.value)}
                  fullWidth
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="text" onClick={closeInputOverlay}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" disableElevation>
                    Create Node
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-500 text-sm bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow select-none" style={{ caretColor: 'transparent' }}>
        Hold canvas 0.5s to seed an idea • Hold + swipe a node or press Enter to branch • Scroll to zoom • Middle-click drag to pan • Right-click for tools
      </div>
    </div>
  );
}
