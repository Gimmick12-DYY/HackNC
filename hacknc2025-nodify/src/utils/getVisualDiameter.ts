import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { NodeItem } from "@/components/types";

export const VISUAL_NODE_MINIMIZED_SIZE = 24;

export const getVisualDiameter = (
  node: NodeItem,
  distance?: number
): number => {
  if (node.minimized) {
    return VISUAL_NODE_MINIMIZED_SIZE;
  }

  if (!Number.isFinite(distance)) {
    return NodeVisualConfig.SIZE_LEVELS.SMALLEST_SIZE;
  }

  const level = Math.max(0, Math.floor(distance as number));
  const sizeLevels = NodeVisualConfig.SIZE_LEVELS as Record<number, number>;

  return (
    sizeLevels[level] ?? NodeVisualConfig.SIZE_LEVELS.SMALLEST_SIZE
  );
};
