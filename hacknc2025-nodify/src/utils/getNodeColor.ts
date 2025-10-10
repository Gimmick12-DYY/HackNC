import type { ThemeDefinition } from "@/components/Themes";
import { NodeVisualConfig } from "@/config/nodeVisualConfig";

export const getNodeColor = (type: string, theme?: ThemeDefinition) => {
  if (theme) {
    const palette = theme.node.palette;
    const match =
      palette[type as keyof typeof palette] ?? palette.default ?? null;
    if (match) return match;
  }
  const fallback =
    NodeVisualConfig.COLOR_PROFILES as Record<string, string | undefined>;
  return (
    fallback[type as keyof typeof fallback] ??
    fallback.idea ??
    paletteFallback()
  );
};

const paletteFallback = () => "#CCCCCC";
