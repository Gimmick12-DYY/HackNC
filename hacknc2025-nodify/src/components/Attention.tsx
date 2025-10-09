"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { NodeGraph, NodeID } from "./types";

export interface AttentionState {
  focusedNodeId: string | null;
  distances: Record<string, number>;
  setFocusedNode: (id: string | null) => void;
  recomputeDistances: (graph: NodeGraph, focusId: string | null) => void;
}

const AttentionContext = createContext<AttentionState | undefined>(undefined);

const computeDistances = (graph: NodeGraph, focusId: NodeID) => {
  const result: Record<string, number> = { [focusId]: 0 };
  const visited = new Set<NodeID>([focusId]);
  const queue: Array<{ id: NodeID; distance: number }> = [
    { id: focusId, distance: 0 },
  ];

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;
    const neighbors = graph.adjacency[id] ?? [];
    const nextDistance = distance + 1;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      result[neighbor] = nextDistance;
      queue.push({ id: neighbor, distance: nextDistance });
    }
  }

  return result;
};

export const AttentionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});
  const graphRef = useRef<NodeGraph | null>(null);

  const recomputeDistances = useCallback((graph: NodeGraph, focusId: string | null) => {
    graphRef.current = graph;
    if (!focusId) {
      setFocusedNodeId(null);
      setDistances({});
      return;
    }

    setFocusedNodeId(focusId);
    setDistances(computeDistances(graph, focusId));
  }, []);

  const setFocusedNode = useCallback((id: string | null) => {
    setFocusedNodeId(id);
    if (!id || !graphRef.current) {
      setDistances({});
      return;
    }
    const graph = graphRef.current;
    setDistances(computeDistances(graph, id));
  }, []);

  const value = useMemo<AttentionState>(
    () => ({
      focusedNodeId,
      distances,
      setFocusedNode,
      recomputeDistances,
    }),
    [distances, focusedNodeId, recomputeDistances, setFocusedNode]
  );

  return (
    <AttentionContext.Provider value={value}>
      {children}
    </AttentionContext.Provider>
  );
};

export const useAttention = () => {
  const ctx = useContext(AttentionContext);
  if (!ctx) {
    throw new Error("useAttention must be used within an AttentionProvider");
  }
  return ctx;
};

export const useNodeAttention = (nodeId: NodeID) => {
  const { distances } = useAttention();
  return useMemo(
    () => ({
      distance: distances[nodeId] ?? Number.POSITIVE_INFINITY,
    }),
    [distances, nodeId]
  );
};
