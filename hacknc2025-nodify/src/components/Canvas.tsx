"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import NodeCard from "./Node";
import { DashboardParams, NodeItem, InfoData, NodeID, NodeGraph, NodeData } from "./types";
import { getVisualDiameter, VISUAL_NODE_MINIMIZED_SIZE } from "@/utils/getVisualDiameter";
import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { DisjointSet } from "@/utils/disjointSet";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MinimizeRoundedIcon from "@mui/icons-material/MinimizeRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import { Button, Snackbar, Alert } from "@mui/material";
import { useAttention } from "./Attention";
import { getNodeColor } from "@/utils/getNodeColor";
import { useTheme, hexToRgba } from "./Themes";

type Props = {
  params: DashboardParams;
  onRequestInfo?: (info: InfoData | null) => void;
};

type NodeMap = Record<string, NodeItem>;
type GeneratedNodeContent = Omit<NodeData, "id" | "level">;

type InputOverlayState = {
  open: boolean;
  mode: "create-root";
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

type ExpandOverlayState = {
  open: boolean;
  nodeId: string | null;
  text: string;
  count: number; // 选择扩展数量
};

type PendingConnectionState = {
  childId: string;
};

type SerializedGraphNode = {
  id: string;
  x: number;
  y: number;
  parentId: string | null;
  children: string[];
  size?: number;
  level: number;
  type: string;
  full: string;
  phrase?: string;
  short?: string;
  emoji?: string;
  minimized?: boolean;
  dotColor?: string;
  text?: string;
  groupId?: string;
};

type SerializedGraphState = {
  version: number;
  nodes: SerializedGraphNode[];
  edges: Array<[string, string]>;
  groups: Record<string, string>;
  nextIdCounter: number;
  camera: { scale: number; offsetX: number; offsetY: number };
  focusedNodeId?: string | null;
  timestamp: number;
};

const GRAPH_STORAGE_KEY = "nodify.graph-state.v1";
const GRAPH_STORAGE_VERSION = 1;

const areGroupMapsEqual = (
  a: Record<string, string>,
  b: Record<string, string>
) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const PHYSICS = {
  springLength: 200,
  springK: 1.1,
  springNonLinearStrength: 1.2,
  springNonLinearPower: 3,
  springNonLinearClamp: 0.8,
  enableRepulsion: true,
  repulsion: 10000,
  maxRepelDist: 420,
  gravityK: 0.0015,
  damping: 0.93,
  maxSpeed: 32000000,
  timeStep: 1 / 120,
  cellSize: 240,
  dragSpringBoost: 2,
  tetherMinFactor: 0.97,
  tetherMaxFactor: 1.03,
  tetherIterations: 4,
  maxStep: 25,
  cursorMinMotionPx: 5,
} as const;

const HOLD_DURATION_MS = 500;
const ROOT_HOLD_MOVE_THRESHOLD = 18;
const NODE_HOLD_MOVE_THRESHOLD = 24;
const PREVIEW_PLACEHOLDER_SIZE = 150;
const MAX_GENERATED_COUNT = 12;

export default function Canvas({ params, onRequestInfo }: Props) {
  const [nodes, setNodes] = useState<NodeMap>({});
  const [edges, setEdges] = useState<Array<[string, string]>>([]); // [parent, child]
  const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});
  const [pendingConnection, setPendingConnection] = useState<PendingConnectionState | null>(null);
  const [graphHydrated, setGraphHydrated] = useState(false);
  const storageHydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  // 多选：用 Set 存储所有选中节点
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const committedFocusIdRef = useRef<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoverClearTimerRef = useRef<number | null>(null);
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
  const [expandOverlay, setExpandOverlay] = useState<ExpandOverlayState>({
    open: false,
    nodeId: null,
    text: "",
    count: Math.max(1, params.nodeCount || 3),
  });
  const [expandSliderVisible, setExpandSliderVisible] = useState(false);
  const [topBanner, setTopBanner] = useState<{ open: boolean; text: string }>({ open: false, text: "" });
  const [snack, setSnack] = useState<{ open: boolean; text: string; severity: 'info' | 'warning' | 'error' | 'success' }>({ open: false, text: '', severity: 'info' });
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const showBanner = useCallback((text: string) => setTopBanner({ open: true, text }), []);
  const hideBanner = useCallback(() => setTopBanner({ open: false, text: '' }), []);
  const showSnack = useCallback((text: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    setSnack({ open: true, text, severity });
  }, []);

  const { theme } = useTheme();
  const floatingButton = theme.ui.floatingButton;

  const { distances, focusedNodeId, setFocusedNode, recomputeDistances } = useAttention();
  
  // 视口状态：缩放和平移
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  // 框选矩形（使用屏幕坐标）
  const [selectionRect, setSelectionRect] = useState<{ active: boolean; start: { x: number; y: number } | null; current: { x: number; y: number } | null }>({ active: false, start: null, current: null });
  
  const draggingNodesRef = useRef(new Set<string>());
  const canvasRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  // Drag throttling
  const dragFrameRef = useRef<number | null>(null);
  const dragPendingRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const edgesRef = useRef(edges);
  const nodesRef = useRef<NodeMap>({});
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const hasInitializedCameraRef = useRef(false);
  const rootHoldTimerRef = useRef<number | null>(null);
  const rootHoldActiveRef = useRef(false);
  const rootHoldStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const rootHoldWorldRef = useRef<{ x: number; y: number } | null>(null);
  const nodeHoldTimerRef = useRef<number | null>(null);
  const nodeHoldInfoRef = useRef<{ nodeId: string; startClient: { x: number; y: number }; startCanvas: { x: number; y: number } } | null>(null);
  const instructionsButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (instructionsButtonRef.current) {
      instructionsButtonRef.current.style.width = "56px";
      instructionsButtonRef.current.style.paddingRight = "16px";
      instructionsButtonRef.current.style.background = instructionsOpen
        ? floatingButton.hover
        : floatingButton.background;
    }
  }, [instructionsOpen, floatingButton]);
  const expandMenuRef = useRef<HTMLDivElement | null>(null);
  const expandSliderRef = useRef<HTMLDivElement | null>(null);
  const expandMenuPointerRef = useRef<{ active: boolean; sliderVisible: boolean; startX: number; source: "menu" | "slider" | null }>({ active: false, sliderVisible: false, startX: 0, source: null });
  // 组拖拽：记录起点和各节点原始位置
  const groupDragStartRef = useRef<{ anchorId: string | null; origin: Map<string, { x: number; y: number }> }>({ anchorId: null, origin: new Map() });

  const attentionGraph = useMemo<NodeGraph>(() => {
    const adjacency: Record<string, Set<string>> = {};
    Object.values(nodes).forEach((node) => {
      if (!adjacency[node.id]) adjacency[node.id] = new Set();
      node.children.forEach((childId) => {
        if (!adjacency[node.id]) adjacency[node.id] = new Set();
        adjacency[node.id].add(childId);
        if (!adjacency[childId]) adjacency[childId] = new Set();
        adjacency[childId].add(node.id);
      });
      if (node.parentId) {
        adjacency[node.id].add(node.parentId);
        if (!adjacency[node.parentId]) adjacency[node.parentId] = new Set();
        adjacency[node.parentId].add(node.id);
      }
    });

    Object.keys(nodes).forEach((id) => {
      if (!adjacency[id]) adjacency[id] = new Set();
    });

    const normalized: Record<string, string[]> = {};
    Object.entries(adjacency).forEach(([id, neighbors]) => {
      normalized[id] = Array.from(neighbors);
    });

    return { adjacency: normalized };
  }, [nodes]);

  const computeGroupAssignmentsFor = useCallback(
    (map: NodeMap, connectionPairs: Array<[string, string]>) => {
      const ds = new DisjointSet<string>();
      Object.keys(map).forEach((id) => ds.add(id));
      connectionPairs.forEach(([a, b]) => {
        if (ds.has(a) && ds.has(b)) {
          ds.union(a, b);
        }
      });
      const assignments: Record<string, string> = {};
      Object.keys(map).forEach((id) => {
        assignments[id] = ds.findRepresentative(id) ?? id;
      });
      return assignments;
    },
    []
  );

  useEffect(() => {
    const assignments = computeGroupAssignmentsFor(nodes, edges);
    setGroupAssignments((prev) =>
      areGroupMapsEqual(prev, assignments) ? prev : assignments
    );
  }, [nodes, edges, computeGroupAssignmentsFor]);

  const nextId = () => `n_${idRef.current++}`;
  const computeNextIdSeed = useCallback((map: NodeMap) => {
    let max = -1;
    Object.keys(map).forEach((id) => {
      const numeric = Number(id.split("_")[1]);
      if (Number.isFinite(numeric) && numeric > max) {
        max = numeric;
      }
    });
    return Math.max(max + 1, 0);
  }, []);

  const commitFocus = useCallback(
    (id: string | null) => {
      committedFocusIdRef.current = id;
      setFocusedNode(id);
    },
    [setFocusedNode]
  );

  const handleNodeHover = useCallback((id: string) => {
    // Cancel any pending focus-clear timer and focus this node immediately
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
    hoveredNodeIdRef.current = id;
    setFocusedNode(id);
  }, [setFocusedNode]);

  const handleNodeHoverLeave = useCallback((id: string) => {
    if (hoveredNodeIdRef.current === id) {
      hoveredNodeIdRef.current = null;
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
      }
      // Hold focus for 0.5s after leaving all nodes before minimizing
      hoverClearTimerRef.current = window.setTimeout(() => {
        // Only clear if no node has been hovered again
        if (!hoveredNodeIdRef.current) {
          setFocusedNode(null);
        }
        hoverClearTimerRef.current = null;
      }, 500);
    }
  }, [setFocusedNode]);

  useEffect(() => {
    // When no node is focused/hovered, clear distances so nodes minimize
    recomputeDistances(attentionGraph, focusedNodeId ?? null);
  }, [attentionGraph, focusedNodeId, recomputeDistances]);

  useEffect(() => {
    if (hoveredNodeIdRef.current) return;
    if (!focusedNodeId) {
      committedFocusIdRef.current = null;
      return;
    }
    if (
      committedFocusIdRef.current === null ||
      !nodes[committedFocusIdRef.current]
    ) {
      committedFocusIdRef.current = focusedNodeId;
    }
  }, [focusedNodeId, nodes]);

  // Fixed node sizes by hierarchy depth (0=root)
  const NODE_SIZES = useMemo(() => [220, 160, 120, 100] as const, []);
  const computeSizeByDepth = useCallback(
    (depth: number) => {
      if (depth < 0) return NODE_SIZES[0];
      if (depth >= NODE_SIZES.length) return NODE_SIZES[NODE_SIZES.length - 1];
      return NODE_SIZES[depth];
    },
    [NODE_SIZES]
  );
  const getDepthIn = useCallback((map: NodeMap, nodeId: string): number => {
    let depth = 0;
    const visited = new Set<string>();
    let cur: NodeItem | undefined = map[nodeId];
    while (cur && cur.parentId) {
      if (visited.has(cur.id)) break;
      visited.add(cur.id);
      const parentNode: NodeItem | undefined = cur.parentId ? map[cur.parentId] : undefined;
      if (!parentNode) break;
      depth += 1;
      cur = parentNode;
    }
    return depth;
  }, []);

  // =========================
  // Physics simulation (force layout)
  // =========================
  type Velocity = { vx: number; vy: number };
  const physicsStateRef = useRef<{
    running: boolean;
    frameId: number | null;
    lastTs: number;
    velocities: Map<string, Velocity>;
    settleUntil: number | null; // run until this timestamp when not dragging
  }>({ running: false, frameId: null, lastTs: 0, velocities: new Map(), settleUntil: null });

  const ensurePhysicsActive = useCallback(() => {
    const s = physicsStateRef.current;
    if (s.running) return;
    s.running = true;
    s.frameId = requestAnimationFrame(function step(ts) {
      s.lastTs = ts;
      const { timeStep } = PHYSICS;
      const currentNodes = nodesRef.current;
      const ids = Object.keys(currentNodes);
      const positions = new Map<string, { x: number; y: number; size: number }>();
      for (const id of ids) {
        const n = currentNodes[id];
        const size = n.size ?? 160;
        positions.set(id, { x: n.x + size / 2, y: n.y + size / 2, size });
        if (!s.velocities.has(id)) s.velocities.set(id, { vx: 0, vy: 0 });
      }

      const cell = (v: number) => Math.floor(v / PHYSICS.cellSize);
      const grid = new Map<string, string[]>();
      const put = (cx: number, cy: number, id: string) => {
        const key = `${cx},${cy}`;
        const list = grid.get(key);
        if (list) list.push(id); else grid.set(key, [id]);
      };
      ids.forEach((id) => {
        const p = positions.get(id)!;
        put(cell(p.x), cell(p.y), id);
      });

      const forces = new Map<string, { fx: number; fy: number }>();
      const addForce = (id: string, fx: number, fy: number) => {
        const f = forces.get(id);
        if (f) { f.fx += fx; f.fy += fy; } else { forces.set(id, { fx, fy }); }
      };

      const connected = new Set<string>();
      const stickParentOf = new Map<string, string>();
      const makeKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

      const seen = new Set<string>();
      for (const [pa, pb] of edgesRef.current) {
        const key = pa < pb ? `${pa}-${pb}` : `${pb}-${pa}`;
        if (seen.has(key)) continue;
        seen.add(key);
        connected.add(makeKey(pa, pb));
        const a = positions.get(pa); const b = positions.get(pb);
        if (!a || !b) continue;
        if (draggingNodesRef.current.has(pa) && !draggingNodesRef.current.has(pb)) stickParentOf.set(pb, pa);
        else if (draggingNodesRef.current.has(pb) && !draggingNodesRef.current.has(pa)) stickParentOf.set(pa, pb);
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const dirx = dx / dist; const diry = dy / dist;
        const target = PHYSICS.springLength + (a.size + b.size) * 0.25;
        const stretch = dist - target;
        const kBoost = (draggingNodesRef.current.has(pa) || draggingNodesRef.current.has(pb)) ? PHYSICS.dragSpringBoost : 1;
        const stretchRatioRaw = target > 0 ? Math.abs(stretch) / target : 0;
        const stretchRatio = Math.min(stretchRatioRaw, PHYSICS.springNonLinearClamp);
        const nonlinearMultiplier = 1 + PHYSICS.springNonLinearStrength * Math.pow(stretchRatio, PHYSICS.springNonLinearPower);
        const effectiveK = PHYSICS.springK * nonlinearMultiplier;
        const f = stretch * effectiveK * kBoost;
        addForce(pa, f * dirx, f * diry);
        addForce(pb, -f * dirx, -f * diry);
      }

      if (PHYSICS.enableRepulsion) {
        for (const id of ids) {
          const p = positions.get(id)!;
          const cx = cell(p.x), cy = cell(p.y);
          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const key = `${cx + ox},${cy + oy}`;
              const list = grid.get(key);
              if (!list) continue;
              for (const otherId of list) {
                if (otherId === id) continue;
                if (connected.has(makeKey(id, otherId))) continue;
                const q = positions.get(otherId)!;
                const dx = p.x - q.x; const dy = p.y - q.y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= 1) continue;
                if (distSq > PHYSICS.maxRepelDist * PHYSICS.maxRepelDist) continue;
                const invDist = 1 / Math.sqrt(distSq);
                const strength = PHYSICS.repulsion * invDist * invDist;
                addForce(id, dx * invDist * strength, dy * invDist * strength);
              }
            }
          }
        }
      }

      for (const id of ids) {
        const p = positions.get(id)!;
        addForce(id, -p.x * PHYSICS.gravityK, -p.y * PHYSICS.gravityK);
      }

      const dragging = draggingNodesRef.current;
      const minMotionSq = PHYSICS.cursorMinMotionPx * PHYSICS.cursorMinMotionPx;
      const nextCenters = new Map<string, { x: number; y: number; size: number }>();
      for (const id of ids) {
        if (dragging.has(id)) {
          const vel = s.velocities.get(id);
          if (vel) { vel.vx = 0; vel.vy = 0; }
          const p = positions.get(id)!;
          nextCenters.set(id, { x: p.x, y: p.y, size: p.size });
          continue;
        }
        const f = forces.get(id) || { fx: 0, fy: 0 };
        const vel = s.velocities.get(id)!;
        vel.vx = (vel.vx + f.fx) * PHYSICS.damping;
        vel.vy = (vel.vy + f.fy) * PHYSICS.damping;
        const speed = Math.hypot(vel.vx, vel.vy);
        if (speed > PHYSICS.maxSpeed) { const scale = PHYSICS.maxSpeed / speed; vel.vx *= scale; vel.vy *= scale; }
        const p = positions.get(id)!;
        const nx = p.x + vel.vx * timeStep;
        const ny = p.y + vel.vy * timeStep;
        nextCenters.set(id, { x: nx, y: ny, size: p.size });
      }

      if (stickParentOf.size > 0) {
        for (const [childId, parentId] of stickParentOf.entries()) {
          const parentNext = nextCenters.get(parentId) || positions.get(parentId);
          const childTentative = nextCenters.get(childId) || positions.get(childId);
          if (!parentNext || !childTentative) continue;
          let dx = childTentative.x - parentNext.x; let dy = childTentative.y - parentNext.y;
          let len = Math.hypot(dx, dy); if (len < 1) { dx = 1; dy = 0; len = 1; }
          const ux = dx / len; const uy = dy / len;
          const target = PHYSICS.springLength + ((parentNext.size + childTentative.size) * 0.25);
          const nx = parentNext.x + ux * target; const ny = parentNext.y + uy * target;
          nextCenters.set(childId, { x: nx, y: ny, size: childTentative.size });
          const v = s.velocities.get(childId); if (v) { v.vx = 0; v.vy = 0; }
        }
      }

      for (let iter = 0; iter < PHYSICS.tetherIterations; iter++) {
        for (const [pa, pb] of edgesRef.current) {
          const a = nextCenters.get(pa) || positions.get(pa);
          const b = nextCenters.get(pb) || positions.get(pb);
          if (!a || !b) continue;
          const dx = b.x - a.x; const dy = b.y - a.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const target = PHYSICS.springLength + ((a.size + b.size) * 0.25);
          const minD = target * PHYSICS.tetherMinFactor;
          const maxD = target * PHYSICS.tetherMaxFactor;
          let desired = dist;
          if (dist > maxD) desired = maxD; else if (dist < minD) desired = minD; else continue;
          const ux = dx / dist; const uy = dy / dist;
          const adjustX = ux * (dist - desired); const adjustY = uy * (dist - desired);
          const aDragging = dragging.has(pa); const bDragging = dragging.has(pb);
          if (aDragging && !bDragging) { const nb = nextCenters.get(pb)!; nb.x -= adjustX; nb.y -= adjustY; nextCenters.set(pb, nb); }
          else if (!aDragging && bDragging) { const na = nextCenters.get(pa)!; na.x += adjustX; na.y += adjustY; nextCenters.set(pa, na); }
          else if (!aDragging && !bDragging) { const na = nextCenters.get(pa)!; na.x += adjustX * 0.5; na.y += adjustY * 0.5; nextCenters.set(pa, na); const nb = nextCenters.get(pb)!; nb.x -= adjustX * 0.5; nb.y -= adjustY * 0.5; nextCenters.set(pb, nb); }
        }
      }

      for (const id of ids) {
        const prev = positions.get(id)!;
        const cur = nextCenters.get(id);
        if (!cur) { nextCenters.set(id, { ...prev }); continue; }
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const moveSq = dx * dx + dy * dy;
        if (moveSq < minMotionSq && !dragging.has(id)) {
          cur.x = prev.x;
          cur.y = prev.y;
          nextCenters.set(id, cur);
          const vel = s.velocities.get(id);
          if (vel) { vel.vx = 0; vel.vy = 0; }
          continue;
        }
        const dist = Math.sqrt(moveSq);
        if (dist > PHYSICS.maxStep) {
          const sScale = PHYSICS.maxStep / dist;
          cur.x = prev.x + dx * sScale;
          cur.y = prev.y + dy * sScale;
          nextCenters.set(id, cur);
        }
      }

      const updates: Array<[string, { x: number; y: number }]> = [];
      for (const id of ids) {
        const c = nextCenters.get(id) || positions.get(id)!;
        const nextX = c.x - (c.size / 2);
        const nextY = c.y - (c.size / 2);
        const existing = currentNodes[id];
        if (!existing) continue;
        if (Math.abs(existing.x - nextX) < 0.01 && Math.abs(existing.y - nextY) < 0.01) continue;
        updates.push([id, { x: nextX, y: nextY }]);
      }
      if (updates.length) {
        setNodes((prev) => {
          let base = prev;
          let mutated = false;
          for (const [id, pos] of updates) {
            const node = base[id];
            if (!node) continue;
            if (Math.abs(node.x - pos.x) < 0.01 && Math.abs(node.y - pos.y) < 0.01) continue;
            if (!mutated) { base = { ...prev }; mutated = true; }
            base[id] = { ...node, x: pos.x, y: pos.y };
          }
          return mutated ? base : prev;
        });
      }

      if (draggingNodesRef.current.size === 0) {
        if (physicsStateRef.current.settleUntil != null && ts < physicsStateRef.current.settleUntil) {
          // keep settling
        } else {
          s.running = false; s.frameId = null; physicsStateRef.current.settleUntil = null; return;
        }
      }

      s.frameId = requestAnimationFrame(step);
    });
  }, []);

  const schedulePhysicsSettle = useCallback((duration = 1500) => {
    requestAnimationFrame(() => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const target = now + duration;
      const current = physicsStateRef.current.settleUntil ?? 0;
      physicsStateRef.current.settleUntil = Math.max(current, target);
      ensurePhysicsActive();
    });
  }, [ensurePhysicsActive]);

  const buildGraphSnapshot = useCallback((): SerializedGraphState => {
    const nodesPayload: SerializedGraphNode[] = Object.values(nodes).map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      parentId: node.parentId ?? null,
      children: [...node.children],
      size: node.size,
      level: node.level,
      type: node.type,
      full: node.full,
      phrase: node.phrase,
      short: node.short,
      emoji: node.emoji,
      minimized: node.minimized,
      dotColor: node.dotColor,
      text: node.text,
      groupId: groupAssignments[node.id] ?? node.groupId,
    }));
    const focusToPersist =
      committedFocusIdRef.current ?? focusedNodeId ?? null;
    return {
      version: GRAPH_STORAGE_VERSION,
      nodes: nodesPayload,
      edges,
      groups: groupAssignments,
      nextIdCounter: idRef.current,
      camera: { scale, offsetX, offsetY },
      focusedNodeId: focusToPersist,
      timestamp: Date.now(),
    };
  }, [nodes, edges, groupAssignments, scale, offsetX, offsetY, focusedNodeId]);

  const loadGraphFromStorage = useCallback(
    (options?: { focusMode?: "saved" | "first" | "none"; silent?: boolean }) => {
      if (typeof window === "undefined") return false;
      const raw = window.localStorage.getItem(GRAPH_STORAGE_KEY);
      if (!raw) {
        if (!options?.silent) {
          showSnack("No saved graph found", "info");
        }
        return false;
      }
      try {
        const parsed = JSON.parse(raw) as SerializedGraphState;
        if (!parsed || parsed.version !== GRAPH_STORAGE_VERSION) {
          if (!options?.silent) {
            showSnack("Saved graph is not compatible with this version", "warning");
          }
          return false;
        }
        const map: NodeMap = {};
        parsed.nodes.forEach((node) => {
          map[node.id] = {
            id: node.id,
            x: node.x,
            y: node.y,
            parentId: node.parentId ?? null,
            children: Array.from(new Set(node.children ?? [])),
            level: node.level ?? 0,
            type: node.type,
            full: node.full,
            phrase: node.phrase,
            short: node.short,
            emoji: node.emoji,
            minimized: node.minimized,
            dotColor: node.dotColor,
            text: node.text ?? node.full,
            size: node.size,
            groupId: node.groupId,
          };
        });
        const parentMap = new Map<string, string>();
        const childrenMap: Record<string, string[]> = {};
        parsed.edges.forEach(([parentId, childId]) => {
          if (!map[parentId] || !map[childId]) return;
          parentMap.set(childId, parentId);
          const bucket = childrenMap[parentId] ?? (childrenMap[parentId] = []);
          if (!bucket.includes(childId)) bucket.push(childId);
        });
        Object.keys(map).forEach((id) => {
          const parentId = parentMap.get(id) ?? map[id].parentId ?? null;
          const children = childrenMap[id] ?? map[id].children ?? [];
          map[id] = {
            ...map[id],
            parentId,
            children,
          };
        });

        const visited = new Set<string>();
        const queue: Array<{ id: string; depth: number }> = [];
        Object.values(map).forEach((node) => {
          if (!node.parentId || !map[node.parentId]) {
            queue.push({ id: node.id, depth: 0 });
          }
        });
        while (queue.length > 0) {
          const { id, depth } = queue.shift()!;
          if (visited.has(id)) continue;
          visited.add(id);
          const current = map[id];
          if (!current) continue;
          const calibratedSize = computeSizeByDepth(depth);
          const updatedNode = {
            ...current,
            level: depth,
            size: calibratedSize,
          };
          map[id] = updatedNode;
          updatedNode.children.forEach((childId) => {
            if (map[childId]) {
              queue.push({ id: childId, depth: depth + 1 });
            }
          });
        }

        const sanitizedEdges = parsed.edges.filter(
          ([parentId, childId]) => Boolean(map[parentId] && map[childId])
        );
        setNodes(map);
        setEdges(sanitizedEdges);
        const baseAssignments =
          parsed.groups && Object.keys(parsed.groups).length > 0
            ? parsed.groups
            : computeGroupAssignmentsFor(map, sanitizedEdges);
        const sanitizedAssignments: Record<string, string> = {};
        Object.keys(map).forEach((id) => {
          sanitizedAssignments[id] = baseAssignments[id] ?? id;
        });
        setGroupAssignments(sanitizedAssignments);
        idRef.current =
          parsed.nextIdCounter ?? computeNextIdSeed(map);
        if (parsed.camera) {
          setScale(parsed.camera.scale);
          setOffsetX(parsed.camera.offsetX);
          setOffsetY(parsed.camera.offsetY);
        }
        const focusMode = options?.focusMode ?? "saved";
        let focusId: string | null =
          focusMode === "none"
            ? null
            : focusMode === "first"
              ? Object.keys(map)[0] ?? null
              : parsed.focusedNodeId ?? null;
        if (focusId && !map[focusId]) {
          focusId = Object.keys(map)[0] ?? null;
        }
        if (focusId) {
          commitFocus(focusId);
        } else {
          commitFocus(null);
        }
        setSelectedIds(new Set());
        setPendingConnection(null);
        schedulePhysicsSettle();
        if (!options?.silent) {
          showSnack("Graph loaded from local storage", "success");
        }
        return true;
      } catch (error) {
        console.error("Failed to load graph from storage", error);
        if (!options?.silent) {
          showSnack("Failed to load saved graph", "error");
        }
        return false;
      }
    },
    [
      commitFocus,
      computeGroupAssignmentsFor,
      computeNextIdSeed,
      computeSizeByDepth,
      schedulePhysicsSettle,
      showSnack,
    ]
  );

  useEffect(() => {
    if (graphHydrated || storageHydratedRef.current) return;
    if (typeof window === "undefined") return;
    storageHydratedRef.current = true;
    const loaded = loadGraphFromStorage({ focusMode: "saved", silent: true });
    if (!loaded) {
      idRef.current = computeNextIdSeed(nodesRef.current);
    }
    setGraphHydrated(true);
  }, [graphHydrated, loadGraphFromStorage, computeNextIdSeed]);

  useEffect(() => {
    if (!graphHydrated) return;
    if (typeof window === "undefined") return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const snapshot = buildGraphSnapshot();
        window.localStorage.setItem(
          GRAPH_STORAGE_KEY,
          JSON.stringify(snapshot)
        );
      } catch (error) {
        console.error("Failed to persist graph snapshot", error);
      } finally {
        saveTimerRef.current = null;
      }
    }, 600);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [buildGraphSnapshot, graphHydrated]);

  const handleManualSave = useCallback(() => {
    if (!graphHydrated) {
      showSnack("Graph is not ready to save yet", "warning");
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const snapshot = buildGraphSnapshot();
      window.localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(snapshot));
      showSnack("Graph saved locally", "success");
    } catch (error) {
      console.error("Failed to save graph snapshot", error);
      showSnack("Failed to save graph", "error");
    }
  }, [buildGraphSnapshot, graphHydrated, showSnack]);

  const handleLoadSavedGraph = useCallback(() => {
    loadGraphFromStorage({ focusMode: "saved" });
  }, [loadGraphFromStorage]);

  const handleClearSavedGraph = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(GRAPH_STORAGE_KEY);
    showSnack("Saved graph data cleared", "success");
  }, [showSnack]);


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

  // 世界坐标转换为屏幕坐标（用于将浮层锚定到节点旁）
  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: worldX, y: worldY };
    const canvasX = worldX * scale + offsetX;
    const canvasY = worldY * scale + offsetY;
    const screenX = rect.left + canvasX;
    const screenY = rect.top + canvasY;
    return { x: screenX, y: screenY };
  }, [offsetX, offsetY, scale]);

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

  const closeExpandOverlay = useCallback(() => {
    setExpandOverlay((prev) => ({ ...prev, open: false, nodeId: null }));
    setPreviewState({
      parentId: null,
      placeholders: [],
      anchor: null,
      holdStartClient: null,
      pointerClient: null,
    });
  }, []);

  const openExpandOverlay = useCallback((nodeId: string) => {
    //TODO: suppoert multi-select expabd

    // Prevent reopening the expand overlay for a node whose generation is still running.
    if (generatingNodesRef.current.has(nodeId)) {
      showSnack('Generation for this node is still in progress', 'warning');
      return;
    }
    const n = nodes[nodeId];
    if (!n) return;
    // 确保不再有上下文菜单和预览状态干扰
    setContextMenu(null);
    setPreviewState({
      parentId: null,
      placeholders: [],
      anchor: null,
      holdStartClient: null,
      pointerClient: null,
    });
    setSelectedIds(new Set([nodeId]));
    commitFocus(nodeId);
    const initialCount = Math.min(MAX_GENERATED_COUNT, Math.max(1, params.nodeCount || 3));
    setExpandOverlay({
      open: true,
      nodeId,
      text: n.full || n.text || "",
      count: initialCount,
    });
    setExpandSliderVisible(false);
    expandMenuPointerRef.current = { active: false, sliderVisible: false, startX: 0, source: null };
  }, [nodes, params.nodeCount, showSnack, commitFocus]);

  const handleInputOverlaySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputOverlay.open) return;
    const value = inputOverlayValue.trim();
    if (!value) return;

    if (inputOverlay.mode === "create-root" && inputOverlay.position) {
      const diameter = computeSizeByDepth(0);
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
    
    const depth = parentId ? getDepthIn(nodes, parentId) + 1 : 0;
    const node: NodeItem = {
      id,
      x: safeX,
      y: safeY,
      parentId: parentId ?? null,
      children: [],
      size: computeSizeByDepth(depth),
      level: depth,
      type: "idea",
      full: text,
      phrase: text,
      short: text,
      emoji: "",
      dotColor: getNodeColor("idea", theme),
      text,
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    if (parentId) setEdges((e) => [...e, [parentId, id]]);
    setSelectedIds(new Set([id]));
    schedulePhysicsSettle();
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
  const suppressNextCanvasClickRef = useRef(false);

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
      const target = e.target as HTMLElement;
      const isOnNode = Boolean(target.closest('.node-card'));

      if (!isOnNode) {
        if (!inputOverlay.open) {
          if (rootHoldTimerRef.current !== null) {
            window.clearTimeout(rootHoldTimerRef.current);
          }
          const initialClientX = e.clientX;
          const initialClientY = e.clientY;
          rootHoldActiveRef.current = true;
          rootHoldStartRef.current = { clientX: initialClientX, clientY: initialClientY };
          rootHoldWorldRef.current = screenToCanvas(initialClientX, initialClientY);
          rootHoldTimerRef.current = window.setTimeout(() => {
            rootHoldTimerRef.current = null;
            if (!rootHoldActiveRef.current) return;
            const position = rootHoldWorldRef.current ?? screenToCanvas(initialClientX, initialClientY);
            setInputOverlay({
              open: true,
              mode: "create-root",
              position,
              targetNodeId: null,
            });
            setInputOverlayValue("");
            setSelectionRect({ active: false, start: null, current: null });
            rootHoldActiveRef.current = false;
          }, HOLD_DURATION_MS);
        }
        setSelectionRect({
          active: false,
          start: { x: e.clientX, y: e.clientY },
          current: { x: e.clientX, y: e.clientY },
        });
        setContextMenu(null);
        setSelectedIds(new Set());
        suppressNextCanvasClickRef.current = false;
      } else {
        cancelRootHold();
      }
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    let activateSelection = false;
    if (rootHoldActiveRef.current && rootHoldStartRef.current) {
      const dx = e.clientX - rootHoldStartRef.current.clientX;
      const dy = e.clientY - rootHoldStartRef.current.clientY;
      if (Math.hypot(dx, dy) > ROOT_HOLD_MOVE_THRESHOLD) {
        cancelRootHold();
        activateSelection = true;
      }
    }

    if (isPanning && panStart) {
      setOffsetX(e.clientX - panStart.x);
      setOffsetY(e.clientY - panStart.y);
    }

    if (selectionRect.start) {
      setSelectionRect((prev) => {
        if (!prev.start) return prev;
        const next = {
          ...prev,
          current: { x: e.clientX, y: e.clientY },
        };
        if (activateSelection && !prev.active) {
          suppressNextCanvasClickRef.current = true;
          next.active = true;
        }
        return next;
      });
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
      if (selectionRect.active && selectionRect.start && selectionRect.current) {
        const x1 = Math.min(selectionRect.start.x, selectionRect.current.x);
        const y1 = Math.min(selectionRect.start.y, selectionRect.current.y);
        const x2 = Math.max(selectionRect.start.x, selectionRect.current.x);
        const y2 = Math.max(selectionRect.start.y, selectionRect.current.y);
        const chosen = new Set<string>();
        Object.values(nodes).forEach((n) => {
          const size = n.size ?? 160;
          const tl = worldToScreen(n.x, n.y);
          const br = worldToScreen(n.x + size, n.y + size);
          const nx1 = Math.min(tl.x, br.x);
          const ny1 = Math.min(tl.y, br.y);
          const nx2 = Math.max(tl.x, br.x);
          const ny2 = Math.max(tl.y, br.y);
          const overlap = !(nx2 < x1 || nx1 > x2 || ny2 < y1 || ny1 > y2);
          if (overlap) chosen.add(n.id);
        });
        setSelectedIds(chosen);
      }
      setSelectionRect({ active: false, start: null, current: null });
      // 抑制随后一次 click 清空选择
      setTimeout(() => { suppressNextCanvasClickRef.current = false; }, 0);
    }
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (suppressNextCanvasClickRef.current) {
      // 跳过这次 click，以保留刚刚框选的结果
      suppressNextCanvasClickRef.current = false;
      return;
    }
    // 检查是否点击了节点
    const target = e.target as HTMLElement;
    if (target.closest('.node-card')) {
      return; // 点击在节点上，忽略
    }
    
    // Hide context menu if visible
    setContextMenu(null);
    if (pendingConnection) {
      setPendingConnection(null);
      showSnack("Connection cancelled", "info");
    }
    
    // Clear selection on canvas click
    setSelectedIds(new Set());
  };

  // 点击/双击节点处理函数在 buildInfoData 定义之后声明

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
    const nodeSize = computeSizeByDepth(0);
    
    // 直接使用世界坐标，不做碰撞检测
    const position = { x: worldPos.x, y: worldPos.y };
    
    // Create node without draft status (already confirmed)
    const node: NodeItem = {
      id,
      x: position.x,
      y: position.y,
      parentId: null,
      children: [],
      size: nodeSize,
      level: 0,
      type: "idea",
      full: "",
      phrase: "",
      short: "",
      emoji: "",
      text: "",
      dotColor: getNodeColor("idea", theme),
    };
    setNodes((prev) => ({ ...prev, [id]: node }));
    setSelectedIds(new Set([id]));
    commitFocus(id);
    schedulePhysicsSettle();
    
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
    // 目标：将世界坐标 (0,0) 放到视口中心，缩放为 1
    const rect = canvasRef.current?.getBoundingClientRect();
    const targetScale = 1;
    const targetOffsetX = rect ? rect.width / 2 : 0;
    const targetOffsetY = rect ? rect.height / 2 : 0;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用easeOutCubic缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const newScale = startScale + (targetScale - startScale) * easeProgress;
      const newOffsetX = startOffsetX + (targetOffsetX - startOffsetX) * easeProgress;
      const newOffsetY = startOffsetY + (targetOffsetY - startOffsetY) * easeProgress;
      
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
  
  const buildInfoData = useCallback((rootId: NodeID): InfoData => {
    const visited = new Set<NodeID>();
    const nodesInfo: Record<NodeID, { id: NodeID; text: string; parentId?: NodeID | null; children: NodeID[] }> = {};
    const edgesInfo: Array<[NodeID, NodeID]> = [];

    const dfs = (id: NodeID) => {
      if (visited.has(id)) return;
      visited.add(id);
      const n = nodes[id];
      if (!n) return;
      nodesInfo[id] = { id: n.id, text: n.full || n.text || "", parentId: n.parentId ?? null, children: [...n.children] };
      for (const childId of n.children) {
        edgesInfo.push([id, childId]);
        dfs(childId);
      }
    };

    dfs(rootId);
    return { rootId, nodes: nodesInfo, edges: edgesInfo };
  }, [nodes]);

  const connectNodes = useCallback(
    (childId: string, parentId: string) => {
      if (childId === parentId) {
        showSnack("Cannot connect a node to itself", "warning");
        return false;
      }
      const currentNodes = nodesRef.current;
      const child = currentNodes[childId];
      const parent = currentNodes[parentId];
      if (!child || !parent) {
        showSnack("Selected nodes are no longer available", "error");
        return false;
      }
      const stack = [childId];
      const visited = new Set<string>();
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (currentId === parentId) {
          showSnack("Connecting these nodes would create a cycle", "error");
          return false;
        }
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        const node = currentNodes[currentId];
        if (!node) continue;
        node.children.forEach((cid) => stack.push(cid));
      }
      setNodes((prev) => {
        const next = { ...prev };
        const childNode = next[childId];
        const parentNode = next[parentId];
        if (!childNode || !parentNode) return prev;
        if (childNode.parentId === parentId) return prev;
        if (childNode.parentId && next[childNode.parentId]) {
          const origin = next[childNode.parentId];
          const filteredChildren = origin.children.filter((cid) => cid !== childId);
          if (filteredChildren.length !== origin.children.length) {
            next[childNode.parentId] = { ...origin, children: filteredChildren };
          }
        }
        const parentChildren = parentNode.children.includes(childId)
          ? parentNode.children
          : [...parentNode.children, childId];
        next[parentId] = { ...parentNode, children: parentChildren };
        next[childId] = {
          ...childNode,
          parentId,
        };
        const updateLevels = (map: NodeMap, nodeId: string, depth: number) => {
          const target = map[nodeId];
          if (!target) return;
          const recalibrated = {
            ...target,
            level: depth,
            size: computeSizeByDepth(depth),
          };
          map[nodeId] = recalibrated;
          recalibrated.children.forEach((cid) => updateLevels(map, cid, depth + 1));
        };
        const parentLevel = next[parentId]?.level ?? 0;
        updateLevels(next, childId, parentLevel + 1);
        return next;
      });
      setEdges((prev) => {
        const withoutOld = prev.filter(
          ([p, c]) => !(c === childId && p !== parentId)
        );
        const exists = withoutOld.some(
          ([p, c]) => p === parentId && c === childId
        );
        return exists ? withoutOld : [...withoutOld, [parentId, childId]];
      });
      schedulePhysicsSettle();
      showSnack("Nodes connected successfully", "success");
      return true;
    },
    [computeSizeByDepth, schedulePhysicsSettle, showSnack]
  );

  // 点击节点：单选并打开信息
  const handleNodeClick = useCallback((id: string) => {
    if (pendingConnection) {
      const success = connectNodes(pendingConnection.childId, id);
      if (success) {
        const s = new Set<string>([pendingConnection.childId, id]);
        setSelectedIds(s);
        commitFocus(id);
        setPendingConnection(null);
      }
      return;
    }
    const s = new Set<string>([id]);
    setSelectedIds(s);
    commitFocus(id);
  }, [commitFocus, connectNodes, pendingConnection, setPendingConnection]);

  // 双击节点：进入编辑
  const handleNodeDoubleClick = useCallback((id: string) => {
    handleNodeClick(id);
  }, [handleNodeClick]);

  // 文本更新（来自 Node 内联编辑）
  const handleUpdateText = useCallback(
    (id: string, value: string) => {
      setNodes((prev) => {
        const n = prev[id];
        if (!n) return prev;
        const depth = getDepthIn(prev, id);
        const newSize = computeSizeByDepth(depth);
        const oldSize = n.size ?? 160;
        const cx = n.x + oldSize / 2;
        const cy = n.y + oldSize / 2;
        const nx = cx - newSize / 2;
        const ny = cy - newSize / 2;
        const cleaned = value.trim();
        const fallbackPhrase = cleaned || n.phrase || n.full;
        const fallbackShort =
          cleaned.split(/\s+/)[0] ||
          n.short ||
          (fallbackPhrase ? fallbackPhrase.split(/\s+/)[0] : "");
        return {
          ...prev,
          [id]: {
            ...n,
            text: cleaned,
            full: cleaned,
            phrase: fallbackPhrase,
            short: fallbackShort,
            dotColor: getNodeColor(n.type, theme),
            size: newSize,
            x: nx,
            y: ny,
          },
        };
      });
    },
    [getDepthIn, computeSizeByDepth, theme]
  );

  const emitInfoFor = useCallback(
    (id: string) => {
      if (!onRequestInfo) return;
      const info = buildInfoData(id);
      onRequestInfo({
        ...info,
        updateText: (value: string) => handleUpdateText(id, value),
      });
    },
    [onRequestInfo, buildInfoData, handleUpdateText]
  );
  
  const handleNodeMenuAction = (action: string, nodeId: string) => {
    const actionKey = `${action}-${nodeId}`;
    
    // Prevent double execution
    if (executingActionsRef.current.has(actionKey)) {
      return;
    }
    
  executingActionsRef.current.add(actionKey);
    
    // Clear the action key after a short delay
    setTimeout(() => {
      executingActionsRef.current.delete(actionKey);
    }, 1000);
    
    switch (action) {
      case 'expand':
        console.log('Expand action triggered for node:', nodeId);
        // 先关闭右键菜单，然后在下一帧再打开 Expand 面板，避免状态竞态
        setContextMenu(null);
        requestAnimationFrame(() => {
          openExpandOverlay(nodeId);
        });
        break;
      case 'connect':
        setPendingConnection({ childId: nodeId });
        showSnack('Select another node to complete the connection', 'info');
        break;
      case 'minimize':
        onMinimize?.(nodeId);
        break;
      case 'delete':
        onDelete?.(nodeId);
        break;
      case 'info':
        setSelectedIds(new Set([nodeId]));
        commitFocus(nodeId);
        break;
    }
      // 其余操作执行后关闭菜单
      if (action !== 'expand') {
        setContextMenu(null);
      }
    };

  useEffect(() => {
    if (!onRequestInfo) return;
    if (selectedIds.size !== 1) {
      onRequestInfo(null);
      return;
    }
    const [id] = Array.from(selectedIds);
    emitInfoFor(id);
  }, [selectedIds, emitInfoFor, onRequestInfo]);

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
  }, [setContextMenu]);

  // Keep edgesRef in sync
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const onMove = useCallback((id: string, x: number, y: number) => {
    if (previewState.parentId === id) {
      return;
    }
    // Track dragging nodes for smooth line animations (only add if not already dragging this node)
    if (!draggingNodesRef.current.has(id)) {
      if (draggingNodesRef.current.size === 0) {
        setIsDragging(true);
        physicsStateRef.current.settleUntil = null;
        ensurePhysicsActive();
      }
      draggingNodesRef.current.add(id);
      // 如果是组拖拽，记录所有选中节点的原始位置
      if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id)) {
        const origin = new Map<string, { x: number; y: number }>();
        selectedIdsRef.current.forEach(sid => {
          const n = nodes[sid];
          if (n) origin.set(sid, { x: n.x, y: n.y });
        });
        groupDragStartRef.current = { anchorId: id, origin };
      } else {
        groupDragStartRef.current = { anchorId: null, origin: new Map() };
      }
    }
    // Queue drag updates to the next animation frame (throttle)
    dragPendingRef.current.set(id, { x, y });
    if (dragFrameRef.current == null) {
      dragFrameRef.current = requestAnimationFrame(() => {
        const pending = new Map(dragPendingRef.current);
        dragPendingRef.current.clear();
        dragFrameRef.current = null;
        setNodes((prev) => {
          let next: NodeMap = prev;
          pending.forEach(({ x, y }, dragId) => {
            const node = next[dragId];
            if (!node || (node.x === x && node.y === y)) {
              return;
            }
            // 组拖拽：若当前拖拽的是锚点，移动所有被选中的节点
            const group = groupDragStartRef.current;
            if (group.anchorId === dragId && selectedIdsRef.current.size > 1) {
              const originAnchor = group.origin.get(dragId) ?? { x, y };
              const dx = x - originAnchor.x;
              const dy = y - originAnchor.y;
              const base = next === prev ? { ...prev } : next;
              // 更新锚点
              base[dragId] = { ...node, x, y };
              // 其余选中节点按偏移平移
              for (const sid of selectedIdsRef.current) {
                if (sid === dragId) continue;
                const orig = group.origin.get(sid);
                const target = base[sid];
                if (!orig || !target) continue;
                const nx = orig.x + dx;
                const ny = orig.y + dy;
                if (target.x !== nx || target.y !== ny) {
                  base[sid] = { ...target, x: nx, y: ny };
                }
              }
              next = base;
            } else {
              const base = next === prev ? { ...prev } : next;
              base[dragId] = { ...node, x, y };
              next = base;
            }
          });
          return next;
        });
      });
    }
  }, [previewState.parentId, nodes, ensurePhysicsActive]);

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
      physicsStateRef.current.settleUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 1000;
      ensurePhysicsActive();
    }
    // 清理 pending 帧
    if (dragFrameRef.current != null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    dragPendingRef.current.clear();
  }, [previewState.parentId, ensurePhysicsActive]);

  const onDelete = useCallback((id: string) => {
    setNodes((prev) => {
      const updated = { ...prev };
      delete updated[id];
      if (committedFocusIdRef.current === id) {
        const remainingIds = Object.keys(updated);
        const nextFocus = remainingIds.length ? remainingIds[0] : null;
        commitFocus(nextFocus);
      }
      return updated;
    });
    // Also remove any edges connected to this node
    setEdges((prev) => prev.filter(([parent, child]) => parent !== id && child !== id));
    // Clear selection if this node was selected
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
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
    setPendingConnection((current) =>
      current && current.childId === id ? null : current
    );
  }, [commitFocus]);

  const onMinimize = useCallback((id: string) => {
    setNodes((prev) => {
      const node = prev[id];
      if (!node) return prev;
      const minimizedPalette = theme.node.minimizedPalette;
      const fallbackColor = getNodeColor(node.type ?? "idea", theme);
      if (node.minimized) {
        return {
          ...prev,
          [id]: {
            ...node,
            minimized: false,
            dotColor: undefined,
          },
        };
      }
      const paletteSize = minimizedPalette.length;
      const randomColor =
        minimizedPalette[Math.floor(Math.random() * Math.max(1, paletteSize))] ??
        fallbackColor;
      return {
        ...prev,
        [id]: {
          ...node,
          minimized: true,
          dotColor: randomColor,
        },
      };
    });
  }, [theme]);

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
    async (id: string, options?: { count?: number; textOverride?: string }) => {
      console.log('onGenerate function called with id:', id);
      // Prevent double generation for the same node
      if (generatingNodesRef.current.has(id)) {
        showSnack('Generation for this node is still in progress', 'warning');
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
      
      const effectiveText = (options?.textOverride ?? nodeData?.full ?? nodeData?.text ?? "").trim();
      if (!nodeData || !effectiveText) {
        generatingNodesRef.current.delete(id);
        return;
      }
      
      try {
  const count = Math.max(1, options?.count ?? params.nodeCount);
  const prompt = `Given the parent idea: "${effectiveText}". 
Return exactly ${count} focused child nodes as a JSON array.
Each item must be an object with keys:
- "full": one complete sentence expanding the idea (<= ${params.phraseLength * 10} chars),
- "phrase": a 2-3 word fragment,
- "short": a single evocative word or emoji,
- "emoji": one emoji character,
- "type": one of "idea", "argument", "counter", "reference", "analogy".
Respond with valid JSON only.`;
        let items: GeneratedNodeContent[] = [];
        
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            count,
            phraseLength: params.phraseLength,
            temperature: params.temperature,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          const rawItems = data.items as unknown;
          if (Array.isArray(rawItems)) {
            items = rawItems
              .map((entry): GeneratedNodeContent | null => {
                if (entry && typeof entry === "object") {
                  const obj = entry as Record<string, unknown>;
                  const full = obj.full ?? obj.text ?? obj.phrase;
                  if (!full) return null;
                  return {
                    full: String(full),
                    phrase: obj.phrase ? String(obj.phrase) : undefined,
                    short: obj.short ? String(obj.short) : undefined,
                    emoji: obj.emoji ? String(obj.emoji) : "",
                    type: String(obj.type ?? "idea"),
                  };
                }
                if (typeof entry === "string") {
                  const value = entry.trim();
                  if (!value) return null;
                  return {
                    full: value,
                    phrase: value,
                    short: value.split(" ")[0] ?? value,
                    emoji: "",
                    type: "idea",
                  };
                }
                return null;
              })
              .filter((item): item is GeneratedNodeContent => Boolean(item))
              .slice(0, count);
          }
        }
        
        if (!items || items.length === 0) {
          generatingNodesRef.current.delete(id);
          return;
        }

        const childEdges: [string, string][] = [];
        
        // Calculate smart positions for child nodes
        // 使用父节点的中心点作为起始坐标
  const parentSizeForPlacement = nodeData.size || 160;
  const parentCenterX = nodeData.x + parentSizeForPlacement / 2;
  const parentCenterY = nodeData.y + parentSizeForPlacement / 2;
        
        const positions = arrangeAroundSmart(parentCenterX, parentCenterY, items.length, id);
        
        // Update nodes with new children
        setNodes((prev) => {
          const updated = { ...prev };
          const parent = updated[id];
          if (!parent) return prev;
          
          const childIds: string[] = [];
          items.forEach((content, idx) => {
            const childId = nextId();
            const finalPosition = positions[idx];
            const parentDepth = getDepthIn(updated, id);
            const childSize = computeSizeByDepth(parentDepth + 1);
            const finalX = finalPosition ? finalPosition.x - childSize / 2 : (nodeData?.x || 0);
            const finalY = finalPosition ? finalPosition.y - childSize / 2 : (nodeData?.y || 0);
            const full = content.full?.trim() || "Generated idea";
            const phrase = content.phrase?.trim() || full;
            const shortLabel =
              content.short?.trim() ||
              phrase.split(/\s+/)[0] ||
              full.slice(0, Math.min(10, full.length));
            const emojiValue = content.emoji?.trim();
            const nodeType = content.type?.trim() || "idea";
            
            updated[childId] = {
              id: childId,
              full,
              phrase,
              short: shortLabel,
              emoji: emojiValue,
              type: nodeType,
              text: full,
              // 子节点位置应该是中心点减去节点尺寸的一半
              x: finalX,
              y: finalY,
              parentId: id,
              children: [],
              size: childSize,
              level: parentDepth + 1,
              dotColor: getNodeColor(nodeType, theme),
            };
            childIds.push(childId);
            childEdges.push([id, childId]);
          });
          updated[id] = { ...parent, children: [...parent.children, ...childIds], expanded: true };
          return updated;
        });
        
        setEdges((e) => [...e, ...childEdges]);
        if (childEdges.length > 0) {
          schedulePhysicsSettle();
        }
        
      } catch (error) {
        console.error('Error in generation:', error);
      } finally {
        // Always clean up the generating flag
        generatingNodesRef.current.delete(id);
      }
    },
    [params.nodeCount, params.phraseLength, params.temperature, arrangeAroundSmart, computeSizeByDepth, getDepthIn, schedulePhysicsSettle, showSnack, theme]
  );

  const generatingNodesRef = useRef(new Set<string>());

  // 预览提交由 Expand Overlay 的 Confirm 触发

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

  // 旧的回车/ESC 提交预览逻辑移除，交由覆盖层控制

  const recomputeExpandPreview = useCallback((nodeId: string, count: number) => {
    const parentNode = nodes[nodeId];
    if (!parentNode || parentNode.minimized) return;
    const parentSize = parentNode.size ?? 160;
    const anchorX = parentNode.x + parentSize / 2;
    const anchorY = parentNode.y + parentSize / 2;
    const targetPositions = arrangeAroundSmart(anchorX, anchorY, Math.max(1, count), nodeId);
    const placeholders = targetPositions.map((center, index) => {
      const size = Math.max(120, Math.min(PREVIEW_PLACEHOLDER_SIZE, parentSize + 10));
      return {
        id: `${nodeId}-preview-${index}`,
        x: center.x - size / 2,
        y: center.y - size / 2,
        angle: Math.atan2(center.y - anchorY, center.x - anchorX),
        size,
      } as PreviewPlaceholder;
    });
    setPreviewState({
      parentId: nodeId,
      placeholders,
      anchor: { x: anchorX, y: anchorY },
      holdStartClient: null,
      pointerClient: null,
    });
  }, [nodes, arrangeAroundSmart]);



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
      if (e.key === 'Escape' && pendingConnection) {
        setPendingConnection(null);
        showSnack("Connection cancelled", "info");
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
  }, [contextMenu, onResetCamera, pendingConnection, setPendingConnection, showSnack]);

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

  // 初始化：将世界坐标 (0,0) 放在视口中心
  useEffect(() => {
    if (hasInitializedCameraRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setScale(1);
      setOffsetX(rect.width / 2);
      setOffsetY(rect.height / 2);
    }
    hasInitializedCameraRef.current = true;
  }, []);

  // 当 expandOverlay 打开或其配置变化时，实时计算预览
  useEffect(() => {
    if (!expandOverlay.open || !expandOverlay.nodeId) return;
    recomputeExpandPreview(expandOverlay.nodeId, expandOverlay.count);
  }, [expandOverlay.open, expandOverlay.nodeId, expandOverlay.count, recomputeExpandPreview, nodes]);

  // 确认扩展：更新父节点文本与尺寸（保持中心不变），然后生成
  const confirmExpand = useCallback(async () => {
    if (!expandOverlay.open || !expandOverlay.nodeId) return;
    const parent = nodes[expandOverlay.nodeId];
    if (!parent) return;

    // 先关闭面板，给用户立即反馈
    closeExpandOverlay();
    showBanner('Requesting model API in progress...');

    const newText = expandOverlay.text;
    const parentDepth = getDepthIn(nodes, parent.id);
    const newSize = computeSizeByDepth(parentDepth);
    const oldSize = parent.size ?? 160;
    const centerX = parent.x + oldSize / 2;
    const centerY = parent.y + oldSize / 2;
    const newX = centerX - newSize / 2;
    const newY = centerY - newSize / 2;

    // 立即更新父节点文本与尺寸（不等待生成）
    setNodes((prev) => ({
      ...prev,
      [parent.id]: { ...prev[parent.id], text: newText, size: newSize, x: newX, y: newY },
    }));

    // 后台执行生成，结束后隐藏横幅
    onGenerate(parent.id, { count: expandOverlay.count, textOverride: newText })
      .catch(() => {})
      .finally(() => hideBanner());
  }, [expandOverlay, nodes, onGenerate, closeExpandOverlay, showBanner, hideBanner, setNodes, getDepthIn, computeSizeByDepth]);

  useEffect(() => {
    if (!expandOverlay.open) {
      setExpandSliderVisible(false);
      expandMenuPointerRef.current = { active: false, sliderVisible: false, startX: 0, source: null };
      return;
    }
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!expandMenuRef.current) return;
      if (expandMenuRef.current.contains(event.target as Node)) return;
      closeExpandOverlay();
    };
    window.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [expandOverlay.open, closeExpandOverlay]);

  const updateExpandCountFromClientX = useCallback((clientX: number) => {
    const slider = expandSliderRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clamped = Math.min(Math.max(clientX, rect.left), rect.right);
    const ratio = rect.width === 0 ? 0 : (clamped - rect.left) / rect.width;
    const raw = 1 + ratio * (MAX_GENERATED_COUNT - 1);
    const next = Math.round(raw);
    setExpandOverlay((prev) => {
      if (!prev.open) return prev;
      const constrained = Math.min(MAX_GENERATED_COUNT, Math.max(1, next));
      if (constrained === prev.count) return prev;
      return { ...prev, count: constrained };
    });
  }, []);

  const handleExpandMenuPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    expandMenuPointerRef.current = {
      active: true,
      sliderVisible: expandSliderVisible,
      startX: event.clientX,
      source: "menu",
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [expandSliderVisible]);

  const handleExpandMenuPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!expandMenuPointerRef.current.active || expandMenuPointerRef.current.source !== "menu") return;
    const deltaX = event.clientX - expandMenuPointerRef.current.startX;
    if (!expandMenuPointerRef.current.sliderVisible && deltaX > 24) {
      expandMenuPointerRef.current.sliderVisible = true;
      setExpandSliderVisible(true);
    }
    if (expandMenuPointerRef.current.sliderVisible) {
      updateExpandCountFromClientX(event.clientX);
    }
  }, [updateExpandCountFromClientX]);

  const handleExpandMenuPointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!expandMenuPointerRef.current.active || expandMenuPointerRef.current.source !== "menu") return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    expandMenuPointerRef.current = { active: false, sliderVisible: false, startX: 0, source: null };
    confirmExpand();
  }, [confirmExpand]);

  const handleExpandMenuPointerCancel = useCallback(() => {
    expandMenuPointerRef.current = { active: false, sliderVisible: false, startX: 0, source: null };
  }, []);

  const handleSliderPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    expandMenuPointerRef.current = {
      active: true,
      sliderVisible: true,
      startX: event.clientX,
      source: "slider",
    };
    setExpandSliderVisible(true);
    updateExpandCountFromClientX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [updateExpandCountFromClientX]);

  const handleSliderPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!expandMenuPointerRef.current.active) return;
    event.preventDefault();
    updateExpandCountFromClientX(event.clientX);
  }, [updateExpandCountFromClientX]);

  const handleSliderPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!expandMenuPointerRef.current.active) return;
    event.preventDefault();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    expandMenuPointerRef.current = { active: false, sliderVisible: true, startX: 0, source: null };
  }, []);
  
  // Add ref to track which nodes are currently generating to prevent double execution
  // 不再使用滑动确认预览，预览在 Expand Overlay 打开时重算

  const handleNodeHoldStart = useCallback(
    ({ nodeId }: { nodeId: string; clientX: number; clientY: number }) => {
      if (inputOverlay.open) return;
      cancelNodeHold();
      clearPreview();
      nodeHoldInfoRef.current = { nodeId, startClient: { x: 0, y: 0 }, startCanvas: { x: 0, y: 0 } };
      nodeHoldTimerRef.current = window.setTimeout(() => {
        nodeHoldTimerRef.current = null;
        const info = nodeHoldInfoRef.current;
        if (!info || info.nodeId !== nodeId) return;
        openExpandOverlay(nodeId);
      }, HOLD_DURATION_MS);
    },
    [cancelNodeHold, clearPreview, openExpandOverlay, inputOverlay.open]
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
    ({ nodeId }: { nodeId: string; clientX: number; clientY: number }) => {
      if (nodeHoldInfoRef.current?.nodeId === nodeId) {
        cancelNodeHold();
      }
      // 预览由覆盖层管理
    },
    [cancelNodeHold]
  );

  const lines = useMemo(() => {
    const focusId = focusedNodeId;
    const pairs = edges
      .map(([p, c]) => {
        const parent = nodes[p];
        const child = nodes[c];
        if (!parent || !child) return null;

        // 使用 NodeCard 的同一基准直径逻辑来获取可视中心
        const level0 = (NodeVisualConfig.SIZE_LEVELS as Record<number, number>)[0];
        const getBaseDiameter = (n: NodeItem) => {
          if (n.minimized) return VISUAL_NODE_MINIMIZED_SIZE;
          const target = getVisualDiameter(n, distances[n.id]);
          const defaultBase = level0 ?? target;
          return n.size ?? defaultBase;
        };

        const parentBase = getBaseDiameter(parent);
        const childBase = getBaseDiameter(child);

        const pX = parent.x + parentBase / 2;
        const pY = parent.y + parentBase / 2;
        const cX = child.x + childBase / 2;
        const cY = child.y + childBase / 2;

        const connectedToFocus =
          !!focusId && (parent.id === focusId || child.id === focusId);

        return { pX, pY, cX, cY, key: `${p}-${c}`, connectedToFocus };
      })
      .filter(Boolean) as Array<{
        pX: number;
        pY: number;
        cX: number;
        cY: number;
        key: string;
        connectedToFocus: boolean;
      }>;
    return pairs;
  }, [edges, nodes, distances, focusedNodeId]);

  const lineStrokeWidth = useMemo(() => {
    const { base, minScaleFactor, maxScaleFactor } = NodeVisualConfig.LINE_WIDTH;
    const factor = Math.max(minScaleFactor, Math.min(maxScaleFactor, scale));
    return Number((base * factor).toFixed(3));
  }, [scale]);
  const previewStrokeWidth = useMemo(() => {
    const { previewMultiplier, previewMin } = NodeVisualConfig.LINE_WIDTH;
    return Math.max(previewMin, lineStrokeWidth * previewMultiplier);
  }, [lineStrokeWidth]);
  const linePalette = theme.lines;
  const hasFocusedNode = Boolean(focusedNodeId);

  // 生成网格背景
  const gridConfig = theme.canvas.grid;
  const gridEnabled = Boolean(gridConfig && gridConfig.enabled !== false);
  const gridSize = 35; // 基础网格大小（更密集）
  const gridPattern = useMemo(() => {
    if (!gridEnabled || !gridConfig) {
      return null;
    }

    let actualGridSize = gridSize;

    while (actualGridSize * scale < 20 && actualGridSize < 200) {
      actualGridSize *= 2;
    }

    while (actualGridSize * scale > 200 && actualGridSize > 12.5) {
      actualGridSize /= 2;
    }

    const scaledGridSize = actualGridSize * scale;
    const adjustedOffsetX =
      ((offsetX % scaledGridSize) + scaledGridSize) % scaledGridSize;
    const adjustedOffsetY =
      ((offsetY % scaledGridSize) + scaledGridSize) % scaledGridSize;

    const computeOpacity = (range: { min: number; max: number; scale: number }) => {
      const scaled = scale * range.scale;
      if (!Number.isFinite(scaled)) return range.min;
      return Math.min(range.max, Math.max(range.min, scaled));
    };

    const lineOpacity = computeOpacity(gridConfig.lineOpacity);
    const dotOpacity = computeOpacity(gridConfig.dotOpacity);

    return {
      size: scaledGridSize,
      offsetX: adjustedOffsetX,
      offsetY: adjustedOffsetY,
      lineOpacity,
      dotOpacity,
    };
  }, [gridEnabled, gridConfig, scale, offsetX, offsetY]);

  const backgroundStyles = useMemo(() => {
    if (!gridEnabled || !gridPattern || !gridConfig) {
      return {
        background: theme.canvas.background,
        transition: "background 0.6s ease",
      };
    }

    const gridLineColor = hexToRgba(
      gridConfig.lineColor,
      gridPattern.lineOpacity
    );
    const gridDotColor = hexToRgba(
      gridConfig.dotColor,
      gridPattern.dotOpacity
    );

    return {
      backgroundImage: `
          radial-gradient(${gridDotColor} 1px, transparent 1px),
          linear-gradient(90deg, transparent ${gridPattern.size - 1}px, ${gridLineColor} 1px),
          linear-gradient(transparent ${gridPattern.size - 1}px, ${gridLineColor} 1px),
          ${theme.canvas.background}
        `,
      backgroundSize: `${gridPattern.size}px ${gridPattern.size}px, ${gridPattern.size}px ${gridPattern.size}px, ${gridPattern.size}px ${gridPattern.size}px, 100% 100%`,
      backgroundPosition: `${gridPattern.offsetX}px ${gridPattern.offsetY}px, ${gridPattern.offsetX}px ${gridPattern.offsetY}px, ${gridPattern.offsetX}px ${gridPattern.offsetY}px, 0 0`,
      backgroundRepeat: "repeat, repeat, repeat, no-repeat",
      transition: "background 0.6s ease",
    };
  }, [gridEnabled, gridPattern, gridConfig, theme.canvas.background]);

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
        ...backgroundStyles,
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
            fill={theme.canvas.origin.fill}
            stroke={theme.canvas.origin.stroke}
            strokeWidth={2}
            style={{ 
              vectorEffect: 'non-scaling-stroke' // 保持圆圈大小不受缩放影响
            }}
          />
          <circle
            cx={0}
            cy={0}
            r={2}
            fill={theme.canvas.origin.core}
          />
          
          {lines.map(({ pX, pY, cX, cY, key, connectedToFocus }) => {
            const strokeColor = connectedToFocus
              ? linePalette.connected.stroke
              : hasFocusedNode
                ? linePalette.dimmed.stroke
                : linePalette.default.stroke;
            return (
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
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 520,
                        damping: 36,
                        mass: 0.6,
                        duration: 0.22,
                      }
                }
                stroke={strokeColor}
                strokeWidth={lineStrokeWidth}
                style={{ 
                  vectorEffect: 'non-scaling-stroke' // 保持线条粗细不受缩放影响
                }}
              />
            );
          })}
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
                  stroke={linePalette.preview.stroke}
                  strokeWidth={previewStrokeWidth}
                  strokeDasharray="6 6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: linePalette.preview.opacity }}
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
            <span className="opacity-70">Generating...</span>
          </motion.div>
        ))}

        {Object.values(nodes).map((n) => {
          const assignment = groupAssignments[n.id];
          const nodeForRender =
            assignment && n.groupId !== assignment ? { ...n, groupId: assignment } : n;
          return (
            <NodeCard
              key={n.id}
              node={nodeForRender}
              onMove={onMove}
              onMoveEnd={onMoveEnd}
              onMinimize={onMinimize}
              onContextMenu={onNodeContextMenu}
              highlight={selectedIds.has(n.id)}
              screenToCanvas={screenToCanvas}
              onHoldStart={handleNodeHoldStart}
              onHoldMove={handleNodeHoldMove}
              onHoldEnd={handleNodeHoldEnd}
              onDoubleClickNode={handleNodeDoubleClick}
              onHoverNode={handleNodeHover}
              onHoverLeave={handleNodeHoverLeave}
              onClickNode={handleNodeClick}
              distance={distances[n.id] ?? Number.POSITIVE_INFINITY}
              isGlobalDragging={isDragging}
            />
          );
        })}
      </div>

      { (previewState.parentId) && (
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
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
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
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={handleManualSave}
              >
                <SaveRoundedIcon fontSize="small" className="text-emerald-500" />
                Save Graph Locally
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={handleLoadSavedGraph}
              >
                <CloudDownloadRoundedIcon fontSize="small" className="text-indigo-500" />
                Load Saved Graph
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                onClick={handleClearSavedGraph}
              >
                <DeleteSweepRoundedIcon fontSize="small" className="text-rose-500" />
                Clear Saved Graph
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
                onClick={() => handleNodeMenuAction('info', contextMenu.nodeId!)}
              >
                <InfoOutlinedIcon fontSize="small" className="text-sky-600" />
                Get info
              </button>
              {Object.keys(nodes).length > 1 && (
                <button
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => handleNodeMenuAction('connect', contextMenu.nodeId!)}
                >
                  <LinkRoundedIcon fontSize="small" className="text-indigo-500" />
                  Connect to Node
                </button>
              )}
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
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeInputOverlay}
          />
          <form
            onSubmit={handleInputOverlaySubmit}
            className="relative z-10 w-full max-w-xl flex flex-col items-center gap-8"
          >
            <label className="w-full max-w-md flex flex-col items-center">
              <span className="sr-only">Describe the concept you want to explore</span>
              <input
                autoFocus
                type="text"
                value={inputOverlayValue}
                onChange={(event) => setInputOverlayValue(event.target.value)}
                placeholder="Describe the concept you want to explore…"
                className="w-full bg-transparent text-center text-2xl font-medium text-white border-b border-white/60 focus:border-white focus:outline-none focus:ring-0 transition-colors pb-4 placeholder:text-white/40"
              />
            </label>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="text"
                onClick={closeInputOverlay}
                className="!text-white hover:!bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="text"
                disableElevation
                className="!text-white hover:!bg-white/10"
              >
                Create Node
              </Button>
            </div>
          </form>
          <p className="absolute bottom-12 z-10 text-center text-sm text-white/70 px-8">
            Hold anywhere on the canvas to spark your first thought.
          </p>
        </div>,
        document.body
      )}

      {expandOverlay.open && expandOverlay.nodeId && typeof document !== "undefined" && (() => {
        const node = nodes[expandOverlay.nodeId!];
        if (!node) return null;
        const size = node.size ?? 160;
        // 面板锚点：节点右侧中点，向右偏移 12px
        const rightWorldX = node.x + size + 12;
        const centerWorldY = node.y + size / 2;
        const pt = worldToScreen(rightWorldX, centerWorldY);
        // 视口边界保护（估算面板尺寸）
        const approxWidth = expandSliderVisible ? 360 : 240;
        const approxHeight = expandOverlay.text ? 150 : 120;
        const padding = 8;
        let left = pt.x;
        let top = pt.y - approxHeight / 2;
        if (left + approxWidth + padding > window.innerWidth) {
          // 如果右侧放不下，放到节点左侧
          const leftWorldX = node.x - 12;
          const leftPt = worldToScreen(leftWorldX, centerWorldY);
          left = Math.max(padding, leftPt.x - approxWidth);
        }
        if (top + approxHeight + padding > window.innerHeight) {
          top = window.innerHeight - approxHeight - padding;
        }
        if (top < padding) top = padding;
        const sliderPercent = MAX_GENERATED_COUNT > 1
          ? ((expandOverlay.count - 1) / (MAX_GENERATED_COUNT - 1)) * 100
          : 0;

        return createPortal(
          <div className="fixed z-[75]" style={{ left, top }}>
            <div
              ref={expandMenuRef}
              className="pointer-events-auto relative flex w-56 flex-col overflow-visible rounded-lg border border-white/15 bg-slate-900/95 text-white shadow-xl backdrop-blur-sm"
            >
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Expand with AI
              </div>
              <button
                type="button"
                className="relative flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                onPointerDown={handleExpandMenuPointerDown}
                onPointerMove={handleExpandMenuPointerMove}
                onPointerUp={handleExpandMenuPointerUp}
                onPointerCancel={handleExpandMenuPointerCancel}
                onClick={(event) => event.preventDefault()}
              >
                <span className="font-medium">Generate ideas</span>
                <span className="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-sky-500/20 px-2 py-1 text-xs font-semibold text-sky-100">
                  ×{expandOverlay.count}
                </span>
              </button>
              {expandOverlay.text ? (
                <div className="max-w-full px-3 pb-3 text-xs text-white/45">
                  <span className="block max-h-16 overflow-hidden whitespace-pre-line leading-relaxed">
                    {expandOverlay.text}
                  </span>
                </div>
              ) : (
                <div className="px-3 pb-3 text-xs uppercase tracking-wide text-white/30">
                  Uses existing node text
                </div>
              )}
              {expandSliderVisible && (
                <div
                  ref={expandSliderRef}
                  className="absolute inset-y-1 left-full ml-3 flex w-44 flex-col justify-center gap-2 rounded-lg border border-white/15 bg-slate-900/95 px-3 py-3 shadow-2xl"
                  onPointerDown={handleSliderPointerDown}
                  onPointerMove={handleSliderPointerMove}
                  onPointerUp={handleSliderPointerUp}
                  onPointerCancel={handleSliderPointerUp}
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-white/60">
                    Subnodes
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-1.5 flex-1 rounded-full bg-white/15">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-sky-400 transition-all"
                        style={{ width: `${sliderPercent}%` }}
                      />
                      <div
                        className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border border-white/80 bg-sky-300 shadow"
                        style={{ left: `${sliderPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white/90">{expandOverlay.count}</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase tracking-wide text-white/35">
                    <span>1</span>
                    <span>{MAX_GENERATED_COUNT}</span>
                  </div>
                  <div className="text-[10px] text-white/40">
                    Drag right while holding • release to generate
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* 顶部横幅提示 */}
      {topBanner.open && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80]">
          <div className="bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
            {topBanner.text}
          </div>
        </div>
      )}

      {/* 框选矩形可视化（屏幕坐标） */}
      {selectionRect.active && selectionRect.start && selectionRect.current && (
        <div
          className="fixed z-[60] border-2 border-sky-400/70 bg-sky-200/20"
          style={{
            left: Math.min(selectionRect.start.x, selectionRect.current.x),
            top: Math.min(selectionRect.start.y, selectionRect.current.y),
            width: Math.abs(selectionRect.current.x - selectionRect.start.x),
            height: Math.abs(selectionRect.current.y - selectionRect.start.y),
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Snackbar 提示（重复请求等） */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.text}
        </Alert>
      </Snackbar>

      <div className="fixed bottom-6 left-6 z-[70] pointer-events-none flex flex-col items-start gap-3">
        <AnimatePresence>
          {instructionsOpen && (
            <motion.div
              key="canvas-instructions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto text-sm bg-white/80 backdrop-blur rounded-2xl px-4 py-2 shadow border border-white/60 max-w-xl text-left select-none"
              style={{ color: theme.ui.sidebar.textSecondary, caretColor: "transparent" }}
            >
              Hold canvas 0.5s to seed an idea • Long-press a node or right-click → Expand with AI • Scroll to zoom • Middle-click drag to pan • Drag on empty space to marquee-select • Right-click for tools
            </motion.div>
          )}
        </AnimatePresence>
        <button
          ref={instructionsButtonRef}
          type="button"
          onClick={() => setInstructionsOpen((open) => !open)}
          className="pointer-events-auto rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden"
          style={{
            color: floatingButton.text,
            width: "56px",
            height: "56px",
            padding: "16px",
            background: instructionsOpen
              ? floatingButton.hover
              : floatingButton.background,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.width = "140px";
            e.currentTarget.style.paddingRight = "20px";
            e.currentTarget.style.background = floatingButton.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.width = "56px";
            e.currentTarget.style.paddingRight = "16px";
            e.currentTarget.style.background = instructionsOpen
              ? floatingButton.hover
              : floatingButton.background;
          }}
          aria-label={instructionsOpen ? "Hide Canvas Instructions" : "Show Canvas Instructions"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-5 h-5 flex-shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
            />
          </svg>
          <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {instructionsOpen ? "Close" : "Guide"}
          </span>
        </button>
      </div>
    </div>
  );
}
