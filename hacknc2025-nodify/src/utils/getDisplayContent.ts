import { NodeVisualConfig } from "@/config/nodeVisualConfig";
import { NodeContentLevel, NodeItem } from "@/components/types";

export const getDisplayContent = (node: NodeItem, distance: number) => {
  const normalizedDistance = Number.isFinite(distance)
    ? Math.max(0, Math.floor(distance))
    : Number.POSITIVE_INFINITY;

  const contentKey =
    (
      NodeVisualConfig.CONTENT_LEVELS as Record<
        number,
        NodeContentLevel | "none"
      >
    )[normalizedDistance] ?? NodeVisualConfig.CONTENT_LEVELS.default;

  if (contentKey === "none") {
    return "";
  }

  const key = contentKey as NodeContentLevel;
  const value = node[key];
  return typeof value === "string" ? value : "";
};
