export const NodeVisualConfig = {
  SIZE_LEVELS: {
    0: 100,
    1: 55,
    2: 35,
    3: 20,
    SMALLEST_SIZE: 5,
  },
  CONTENT_LEVELS: {
    0: "full",
    1: "phrase",
    2: "emoji",
    default: "none",
  },
  FOCUSED_LABEL: {
    offset: 0, // px gap between node and label (Y axis)
    fontSize: 13, // px
    textColor: "#111827",
    charWidthFactor: 0.55, // heuristic glyph width factor for wrapping
    arcRadiusOffset: 1, // px distance from node surface to first arc baseline
    arcRadiusGap: 20, // px gap between stacked arc lines
    svgPadding: 16, // px padding in SVG viewbox
    letterSpacing: 0,
    backgroundOpacity: 0.95, // background opacity for label
    backgroundBlur: 8, // blur amount for label background
  },
  COLOR_PROFILES: {
    idea: "#6C63FF",
    argument: "#FF6584",
    counter: "#00BFA6",
    reference: "#FDCB6E",
    analogy: "#E17055",
  },
  TRANSITION: {
    duration: 0.16,
    ease: "easeInOut",
  },
} as const;

export type AttentionSizeLevel = keyof typeof NodeVisualConfig.SIZE_LEVELS;
