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
  minimized?: boolean; // whether node is minimized to a dot
  dotColor?: string; // color of the minimized dot
  isBouncing?: boolean; // for collision bounce animation
};

export type DashboardParams = {
  nodeCount: number; // N
  phraseLength: number; // approximate characters per phrase
  temperature: number; // 0-2
};
