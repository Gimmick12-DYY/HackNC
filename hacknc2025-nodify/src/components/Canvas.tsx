"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import NodeCard from "./Node";
import { DashboardParams, NodeItem } from "./types";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MinimizeRoundedIcon from "@mui/icons-material/MinimizeRounded";

type Props = {
  params: DashboardParams;
};

type NodeMap = Record<string, NodeItem>;

export default function Canvas({ params }: Props) {
  const [nodes, setNodes] = useState<NodeMap>({});
  const [edges, setEdges] = useState<Array<[string, string]>>([]); // [parent, child]
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'canvas' | 'node'; nodeId?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const draggingNodesRef = useRef(new Set<string>());
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const nextId = () => `n_${idRef.current++}`;

  const computeSize = (text: string) => {
    const len = text.trim().length;
    const w = 140 + len * 6; // 6px per char heuristic
    return Math.max(140, Math.min(w, 420));
  };

  const constrainPosition = useCallback((x: number, y: number, nodeSize: number = 160) => {
    // If canvas size not initialized yet, return position as-is
    if (canvasSize.width === 0 || canvasSize.height === 0) {
      return { x, y };
    }
    
    const padding = 20; // Keep nodes away from edges
    const maxX = Math.max(0, canvasSize.width - nodeSize - padding);
    const maxY = Math.max(0, canvasSize.height - nodeSize - padding);
    
    return {
      x: Math.max(padding, Math.min(x, maxX)),
      y: Math.max(padding, Math.min(y, maxY))
    };
  }, [canvasSize.width, canvasSize.height]);

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

  // Find a non-colliding position for a node
  const findNonCollidingPosition = (targetX: number, targetY: number, nodeId: string, nodeSize: number = 160) => {
    let x = targetX;
    let y = targetY;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      const testNode = { x, y, size: nodeSize };
      let hasCollision = false;
      
      // Check against all other nodes
      for (const otherNode of Object.values(nodes)) {
        if (otherNode.id === nodeId || otherNode.minimized) continue;
        
        if (checkCollision(testNode, otherNode)) {
          hasCollision = true;
          break;
        }
      }
      
      if (!hasCollision) {
        return constrainPosition(x, y, nodeSize);
      }
      
      // Try a new position in a spiral pattern
      const angle = (attempts * 0.5) % (2 * Math.PI);
      const radius = 20 + attempts * 5;
      x = targetX + Math.cos(angle) * radius;
      y = targetY + Math.sin(angle) * radius;
      attempts++;
    }
    
    // If no non-colliding position found, return constrained target position
    return constrainPosition(targetX, targetY, nodeSize);
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
      isDraft: !parentId, // top-level clicks start as draft; children are confirmed
      size: computeSize(text),
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    if (parentId) setEdges((e) => [...e, [parentId, id]]);
    setSelectedId(id);
    if (!parentId) setDraftId(id);
    return id;
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return; // ignore clicks on children
    
    // Hide context menu if visible
    setContextMenu(null);
    
    // Clear selection on canvas click
    setSelectedId(null);
  };

  const onCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.currentTarget !== e.target) return; // ignore right clicks on children
    
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
    
    setContextMenu({ x, y, type: 'canvas' });
  };

  const onGenerateNewNode = () => {
    if (!contextMenu) return;
    
    // Calculate position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const targetX = contextMenu.x - rect.left;
    const targetY = contextMenu.y - rect.top;
    
    // Find non-colliding position
    const id = nextId();
    const nodeSize = computeSize("");
    const position = findNonCollidingPosition(targetX, targetY, id, nodeSize);
    
    // Create node without draft status (already confirmed)
    const node: NodeItem = {
      id,
      x: position.x,
      y: position.y,
      text: "",
      parentId: null,
      children: [],
      isDraft: false, // Directly confirmed, not a draft
      size: nodeSize,
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    setSelectedId(id);
    
    setContextMenu(null); // Hide menu after action
  };

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
    
    setContextMenu({ x, y, type: 'node', nodeId });
  }, []);

  const onMove = useCallback((id: string, x: number, y: number) => {
    // Track dragging nodes for smooth line animations (only add if not already dragging this node)
    if (!draggingNodesRef.current.has(id)) {
      if (draggingNodesRef.current.size === 0) {
        setIsDragging(true);
      }
      draggingNodesRef.current.add(id);
    }
    
    // During drag, just update position without collision detection
    // Use functional update to avoid dependency on nodes state
    setNodes((prev) => {
      const node = prev[id];
      const nodeSize = node?.size ?? 160;
      const constrained = constrainPosition(x, y, nodeSize);
      return { ...prev, [id]: { ...prev[id], x: constrained.x, y: constrained.y } };
    });
  }, [constrainPosition]);

  const onMoveEnd = useCallback((id: string, x: number, y: number, originalX?: number, originalY?: number) => {
    setNodes((currentNodes) => {
      const node = currentNodes[id];
      if (!node) return currentNodes;
      
      const nodeSize = node.size ?? 160;
      const constrained = constrainPosition(x, y, nodeSize);
      const targetPosition = { x: constrained.x, y: constrained.y, size: nodeSize };
      
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
          [id]: { ...currentNodes[id], x: constrained.x, y: constrained.y }
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
          // Inline position finding to avoid dependency on nodes state
          let x = originalX;
          let y = originalY;
          let attempts = 0;
          const maxAttempts = 50;
          
          while (attempts < maxAttempts) {
            const testNode = { x, y, size: nodeSize };
            let hasCollision = false;
            
            // Check against all other nodes
            for (const otherNode of Object.values(currentNodes)) {
              if (otherNode.id === id || otherNode.minimized) continue;
              
              if (checkCollision(testNode, otherNode)) {
                hasCollision = true;
                break;
              }
            }
            
            if (!hasCollision) {
              bounceBackPosition = constrainPosition(x, y, nodeSize);
              break;
            }
            
            // Try a new position in a spiral pattern
            const angle = (attempts * 0.5) % (2 * Math.PI);
            const radius = 20 + attempts * 5;
            x = originalX + Math.cos(angle) * radius;
            y = originalY + Math.sin(angle) * radius;
            attempts++;
          }
          
          // If no non-colliding position found, use constrained original position
          if (attempts >= maxAttempts) {
            bounceBackPosition = constrainPosition(originalX, originalY, nodeSize);
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
        // No collision, finalize the move
        return { ...currentNodes, [id]: { ...currentNodes[id], x: constrained.x, y: constrained.y } };
      }
      
      // If collision but no original position provided, just keep current position
      return currentNodes;
    });
    
    // Remove node from dragging set and clear state when all drags complete
    draggingNodesRef.current.delete(id);
    if (draggingNodesRef.current.size === 0) {
      setIsDragging(false);
    }
  }, [constrainPosition]);

  const onText = useCallback((id: string, text: string) => {
    setNodes((prev) => ({
      ...prev,
      [id]: { ...prev[id], text, size: computeSize(text) },
    }));
  }, []);

  const onConfirm = useCallback((id: string) => {
    setNodes((prev) => ({ ...prev, [id]: { ...prev[id], isDraft: false } }));
    setDraftId((current) => current === id ? null : current);
  }, []);

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
    setDraftId((current) => current === id ? null : current);
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

  // Handle window resize and constrain existing nodes
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    // Initial size - use setTimeout to ensure DOM is ready
    setTimeout(updateCanvasSize, 0);

    // Listen for resize
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Constrain all nodes when canvas size changes
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      setNodes((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          const node = updated[id];
          const nodeSize = node.size ?? 160;
          const constrained = constrainPosition(node.x, node.y, nodeSize);
          updated[id] = { ...node, x: constrained.x, y: constrained.y };
        });
        return updated;
      });
    }
  }, [canvasSize]);

  // Close context menu when clicking outside or pressing escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  // 重写的智能散布算法
  const arrangeAroundSmart = (centerX: number, centerY: number, childCount: number, parentId: string) => {
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
      const minSafeDistance = 170; // 节点之间的最小安全距离
      
      // 检查与现有节点的距离
      for (const existing of existingNodes) {
        const nodeX = existing.x + (existing.size || 160) / 2;
        const nodeY = existing.y + (existing.size || 160) / 2;
        if (getDistance(x, y, nodeX, nodeY) < minSafeDistance) {
          return false;
        }
      }
      
      // 检查与已经安排的子节点位置的距离
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
  };

  // Add ref to track which nodes are currently generating to prevent double execution
  const generatingNodesRef = useRef(new Set<string>());
  
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
        const positions = arrangeAroundSmart(nodeData.x + 80, nodeData.y + 80, items.length, id);
        
        // Update nodes with new children
        setNodes((prev) => {
          const updated = { ...prev };
          const parent = updated[id];
          if (!parent) return prev;
          
          const childIds: string[] = [];
          items.forEach((text, idx) => {
            const childId = nextId();
            const finalPosition = positions[idx];
            updated[childId] = {
              id: childId,
              text,
              x: finalPosition ? finalPosition.x - 80 : (nodeData?.x || 0),
              y: finalPosition ? finalPosition.y - 80 : (nodeData?.y || 0),
              parentId: id,
              children: [],
              isDraft: false,
              size: computeSize(text),
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
    [params.nodeCount, params.phraseLength, params.temperature]
  );

  const lines = useMemo(() => {
    const pairs = edges
      .map(([p, c]) => {
        const parent = nodes[p];
        const child = nodes[c];
        if (!parent || !child) return null;
        const pX = parent.x + (parent.size ?? 160) / 2;
        const pY = parent.y + (parent.size ?? 160) / 2;
        const cX = child.x + (child.size ?? 140) / 2;
        const cY = child.y + (child.size ?? 140) / 2;
        return { pX, pY, cX, cY, key: `${p}-${c}` };
      })
      .filter(Boolean) as Array<{ pX: number; pY: number; cX: number; cY: number; key: string }>;
    return pairs;
  }, [edges, nodes]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-[calc(100vh-64px)] bg-gradient-to-br from-[#f7f2e8] to-[#f3eadb] overflow-hidden"
      onClick={onCanvasClick}
      onContextMenu={onCanvasContextMenu}
    >
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
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
          />
        ))}
      </svg>

      {Object.values(nodes).map((n) => (
        <NodeCard
          key={n.id}
          node={n}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          onText={onText}
          onGenerate={onGenerate}
          onConfirm={onConfirm}
          onDelete={onDelete}
          onMinimize={onMinimize}
          onContextMenu={onNodeContextMenu}
          highlight={selectedId === n.id}
          readOnly={!!n.parentId}
        />
      ))}

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
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              onClick={onGenerateNewNode}
            >
              <span className="text-blue-500">✨</span>
              Generate New Node
            </button>
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

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-500 text-sm bg-white/70 backdrop-blur rounded-full px-3 py-1 shadow select-none" style={{ caretColor: 'transparent' }}>
        Right-click anywhere to add a node. Drag to reposition. Press Enter or sparkle to expand.
      </div>
    </div>
  );
}
