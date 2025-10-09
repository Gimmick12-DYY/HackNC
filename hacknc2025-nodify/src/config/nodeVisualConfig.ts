export const NodeVisualConfig = {
  SIZE_LEVELS: {
    0: 80,
    1: 55,
    2: 35,
    3: 20,
    SMALLEST_SIZE: 5,
  },
  CONTENT_LEVELS: {
    0: "full",
    1: "phrase",
    2: "short",
    3: "emoji",
    default: "none",
  },
  COLOR_PROFILES: {
    idea: "#6C63FF",
    argument: "#FF6584",
    counter: "#00BFA6",
    reference: "#FDCB6E",
    analogy: "#E17055",
  },
  TRANSITION: {
    duration: 0.25,
    ease: "easeInOut",
  },
} as const;

export type AttentionSizeLevel = keyof typeof NodeVisualConfig.SIZE_LEVELS;
