import { NodeVisualConfig } from "@/config/nodeVisualConfig";

export const getNodeColor = (type: string) =>
  NodeVisualConfig.COLOR_PROFILES[type as keyof typeof NodeVisualConfig.COLOR_PROFILES] ||
  "#CCCCCC";
