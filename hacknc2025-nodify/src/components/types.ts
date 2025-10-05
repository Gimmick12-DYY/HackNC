export type NodeID = string;

export type NodeItem = {
  id: NodeID;
  text: string;
  x: number;
  y: number;
  parentId?: NodeID | null;
  children: NodeID[];
  expanded?: boolean;
  isDraft?: boolean;
  size?: number; // computed bubble width
};

export type DashboardParams = {
  nodeCount: number; // N
  phraseLength: number; // approximate phrases per phrase
  temperature: number; // 0-2
};
