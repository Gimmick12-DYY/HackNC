export type NodeID = string;

export type NodeItem = {
  id: NodeID;
  text: string;
  x: number;
  y: number;
  parentId?: NodeID | null;
  children: NodeID[];
  expanded?: boolean;
  size?: number; // computed bubble width
  minimized?: boolean; // whether node is minimized to a dot
  dotColor?: string; // color of the minimized dot
  isBouncing?: boolean; // for collision bounce animation
};

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
};