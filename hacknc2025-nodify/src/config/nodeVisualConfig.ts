export const NodeVisualConfig = {
  SIZE_LEVELS: {
    0: 80,
    1: 65,
    2: 50,
    3: 35,
    SMALLEST_SIZE: 20,
  },
  CONTENT_LEVELS: {
    0: "full",
    1: "phrase",
    2: "emoji",
    default: "none",
  },
  FOCUSED_LABEL: {
    offset: 0, // px gap between node and label (Y axis)
    fontSize: 20, // px
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
  LINE_PROFILES: {
    default: {
      stroke: "rgba(176, 190, 210, 0.42)",
    },
    connected: {
      stroke: "rgba(100, 116, 139, 0.85)",
    },
    dimmed: {
      stroke: "rgba(176, 190, 210, 0.2)",
    },
    preview: {
      stroke: "rgba(148, 163, 184, 0.38)",
      opacity: 0.6,
    },
  },
  LINE_WIDTH: {
    base: 1.5,
    minScaleFactor: 0.35,
    maxScaleFactor: 0.8,
    previewMultiplier: 0.75,
    previewMin: 0.3,
  },
  OPACITY_LEVELS: {
    0: 1,
    1: 0.92,
    2: 0.78,
    3: 0.64,
    default: 0.52,
  },
} as const;

export type AttentionSizeLevel = keyof typeof NodeVisualConfig.SIZE_LEVELS;
