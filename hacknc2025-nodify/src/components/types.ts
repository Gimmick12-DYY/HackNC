export type NodeID = string;

export type NodeContentLevel = "full" | "phrase" | "short" | "emoji";

export interface NodeData {
  id: NodeID;
  level: number;
  type: string;
  full: string;
  phrase?: string;
  short?: string;
  emoji?: string;
}

export interface NodeItem extends NodeData {
  x: number;
  y: number;
  parentId?: NodeID | null;
  children: NodeID[];
  expanded?: boolean;
  size?: number;
  minimized?: boolean;
  dotColor?: string;
  isBouncing?: boolean;
  /**
   * Legacy field for backwards compatibility with older node text usage.
   * Prefer the multi-level content fields above.
   */
  text?: string;
}

export interface NodeGraph {
  adjacency: Record<NodeID, NodeID[]>;
}

export type DashboardParams = {
  nodeCount: number; // N
  phraseLength: number; // approximate characters per phrase
  temperature: number; // 0-2
};

// Aggregated information for a node and its subtree for the right-side info panel
export type NodeInfoSummary = {
  id: NodeID;
  text: string;
  parentId?: NodeID | null;
  children: NodeID[];
};

export type InfoData = {
  rootId: NodeID;
  nodes: Record<NodeID, NodeInfoSummary>;
  edges: Array<[NodeID, NodeID]>; // [parent, child]
  updateText?: (value: string) => void;
};
