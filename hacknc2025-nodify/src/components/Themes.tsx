 "use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ThemeOpacityRange = {
  min: number;
  max: number;
  scale: number;
};

export type ThemeGridConfig = {
  enabled?: boolean;
  lineColor: string;
  dotColor: string;
  lineOpacity: ThemeOpacityRange;
  dotOpacity: ThemeOpacityRange;
};

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  previewColors: string[];
  canvas: {
    background: string;
    grid?: ThemeGridConfig | null;
    origin: {
      fill: string;
      stroke: string;
      core: string;
    };
  };
  node: {
    palette: Record<string, string> & { default: string };
    backgroundAlpha: number;
    borderAlpha: number;
    textColor: {
      regular: string;
      minimized: string;
    };
    label: {
      textColor: string;
      background: string;
      opacity: number;
      blur: number;
      letterSpacing?: number;
      fontSize?: number;
      arcRadiusOffset?: number;
      arcRadiusGap?: number;
      svgPadding?: number;
    };
    shadow: {
      default: string;
      highlight: string;
    };
    highlightStroke?: string;
    minimizedPalette: string[];
    opacityLevels?: Record<string | number, number>;
  };
  lines: {
    default: { stroke: string };
    connected: { stroke: string };
    dimmed: { stroke: string };
    preview: { stroke: string; opacity: number };
  };
  ui: {
    header: {
      background: string;
      border: string;
      text: string;
      subtext: string;
    };
    sidebar: {
      background: string;
      border: string;
      headerBackground: string;
      headerText: string;
      headerSubtext: string;
      cardBackground: string;
      cardBorder: string;
      textPrimary: string;
      textSecondary: string;
      textMuted: string;
      inputBackground: string;
      inputBorder: string;
      inputFocus: string;
      inputText: string;
    };
    floatingButton: {
      background: string;
      hover: string;
      text: string;
      indicator: string;
    };
    generateButton: {
      background: string;
      hover: string;
      text: string;
      indicator: string;
    };
  };
};

export type ThemeId = "sunrise" | "obsidian" | "morandi";

const SUNRISE_THEME: ThemeDefinition = {
  id: "sunrise",
  name: "Golden Grid",
  icon: "🌞",
  description: "Warm daylight gradient with calm technicolor nodes.",
  previewColors: ["#f7b731", "#6c63ff", "#00bfa6"],
  canvas: {
    background: "linear-gradient(135deg, #f7f2e8 0%, #f3eadb 100%)",
    grid: {
      enabled: false,
      lineColor: "#9ca3af",
      dotColor: "#e2e8f0",
      lineOpacity: { min: 0.45, max: 0.78, scale: 0.32 },
      dotOpacity: { min: 0.35, max: 0.65, scale: 0.38 },
    },
    origin: {
      fill: "rgba(234, 179, 8, 0.85)",
      stroke: "#f59e0b",
      core: "#facc15",
    },
  },
  node: {
    palette: {
      idea: "#6C63FF",
      argument: "#FF6584",
      counter: "#00BFA6",
      reference: "#FDCB6E",
      analogy: "#E17055",
      default: "#6366F1",
    },
    backgroundAlpha: 0.12,
    borderAlpha: 0.35,
    textColor: { regular: "#1f2937", minimized: "#ffffff" },
    label: {
      textColor: "#111827",
      background: "rgba(255, 255, 255, 0.95)",
      opacity: 0.95,
      blur: 8,
    },
    shadow: {
      default: "0 6px 18px rgba(15, 23, 42, 0.16)",
      highlight: "0 12px 30px rgba(15, 23, 42, 0.25)",
    },
    highlightStroke: "#f59e0b",
    minimizedPalette: [
      "#F59E0B",
      "#F97316",
      "#10B981",
      "#14B8A6",
      "#6366F1",
      "#8B5CF6",
    ],
    opacityLevels: { 0: 1, 1: 0.92, 2: 0.78, 3: 0.64, default: 0.52 },
  },
  lines: {
    default: { stroke: "rgba(176, 190, 210, 0.42)" },
    connected: { stroke: "rgba(100, 116, 139, 0.85)" },
    dimmed: { stroke: "rgba(176, 190, 210, 0.2)" },
    preview: { stroke: "rgba(148, 163, 184, 0.38)", opacity: 0.6 },
  },
  ui: {
    header: {
      background: "rgba(255, 255, 255, 0.72)",
      border: "rgba(226, 232, 240, 0.7)",
      text: "#1f2937",
      subtext: "#64748b",
    },
    sidebar: {
      background: "#fffaf3",
      border: "#e6dccb",
      headerBackground:
        "linear-gradient(90deg, #f7f2e8 0%, #f3eadb 100%)",
      headerText: "#171717",
      headerSubtext: "#6b7280",
      cardBackground: "#ffffff",
      cardBorder: "#e5e7eb",
      textPrimary: "#111827",
      textSecondary: "#374151",
      textMuted: "#6b7280",
      inputBackground: "#f9fafb",
      inputBorder: "#e5e7eb",
      inputFocus: "#6c63ff",
      inputText: "#111827",
    },
    floatingButton: {
      background: "#1f2937",
      hover: "#111827",
      text: "#ffffff",
      indicator: "#ef4444",
    },
    generateButton: {
      background: "#1f2937",
      hover: "#111827",
      text: "#ffffff",
      indicator: "#22c55e",
    },
  },
};

const OBSIDIAN_DARK_THEME: ThemeDefinition = {
  id: "obsidian",
  name: "Obsidian Depths",
  icon: "🪶",
  description: "A pure dark interface with subtle obsidian-inspired glow and muted cyan nodes.",
  previewColors: ["#8ab4f8", "#bb86fc", "#03dac6"],
  canvas: {
    background:
      "radial-gradient(120% 140% at 20% 25%, #0b0b0c 0%, #0a0a0b 40%, #000000 100%)",
    grid: {
      enabled: false,
      lineColor: "#1c1c1d",
      dotColor: "#101011",
      lineOpacity: { min: 0.2, max: 0.45, scale: 0.25 },
      dotOpacity: { min: 0.15, max: 0.35, scale: 0.22 },
    },
    origin: {
      fill: "rgba(138, 180, 248, 0.9)",
      stroke: "#8ab4f8",
      core: "#1e90ff",
    },
  },
  node: {
    palette: {
      idea: "#8ab4f8",
      argument: "#bb86fc",
      counter: "#03dac6",
      reference: "#ffd166",
      analogy: "#f48fb1",
      default: "#9ca3af",
    },
    backgroundAlpha: 0.18,
    borderAlpha: 0.52,
    textColor: { regular: "#f9fafb", minimized: "#18181b" },
    label: {
      textColor: "#e5e7eb",
      background: "rgba(17, 17, 17, 0.9)",
      opacity: 0.88,
      blur: 10,
      letterSpacing: 0.15,
    },
    shadow: {
      default: "0 10px 28px rgba(0, 0, 0, 0.6)",
      highlight: "0 0 34px rgba(138, 180, 248, 0.6)",
    },
    highlightStroke: "#8ab4f8",
    minimizedPalette: [
      "#8ab4f8",
      "#bb86fc",
      "#03dac6",
      "#ffd166",
      "#f48fb1",
      "#9ca3af",
    ],
    opacityLevels: { 0: 1, 1: 0.88, 2: 0.7, 3: 0.5, default: 0.35 },
  },
  lines: {
    default: { stroke: "rgba(138, 180, 248, 0.35)" },
    connected: { stroke: "rgba(187, 134, 252, 0.8)" },
    dimmed: { stroke: "rgba(3, 218, 198, 0.15)" },
    preview: { stroke: "rgba(138, 180, 248, 0.55)", opacity: 0.7 },
  },
  ui: {
    header: {
      background: "rgba(10, 10, 11, 0.88)",
      border: "rgba(31, 31, 32, 0.75)",
      text: "#f9fafb",
      subtext: "#9ca3af",
    },
    sidebar: {
      background: "rgba(15, 15, 16, 0.88)",
      border: "rgba(31, 31, 32, 0.8)",
      headerBackground:
        "linear-gradient(135deg, rgba(24, 24, 25, 0.95) 0%, rgba(10, 10, 11, 0.95) 100%)",
      headerText: "#f9fafb",
      headerSubtext: "#a1a1aa",
      cardBackground: "rgba(20, 20, 21, 0.88)",
      cardBorder: "rgba(38, 38, 39, 0.9)",
      textPrimary: "#e5e7eb",
      textSecondary: "#d1d5db",
      textMuted: "#9ca3af",
      inputBackground: "rgba(10, 10, 11, 0.92)",
      inputBorder: "rgba(138, 180, 248, 0.45)",
      inputFocus: "#8ab4f8",
      inputText: "#f9fafb",
    },
    floatingButton: {
      background: "#18181b",
      hover: "#0f0f10",
      text: "#f9fafb",
      indicator: "#bb86fc",
    },
    generateButton: {
      background: "#8ab4f8",
      hover: "#60a5fa",
      text: "#0b0b0c",
      indicator: "#03dac6",
    },
  },
};

const MORANDI_THEME: ThemeDefinition = {
  id: "morandi",
  name: "Avocado Mist",
  icon: "🥑",
  description: "A serene Morandi palette with pale avocado tones and soft neutrals.",
  previewColors: ["#b8cba3", "#a8b6a1", "#c2b8a3"],
  canvas: {
    background:
      "linear-gradient(180deg, #dbe3d3 0%, #cfd9c2 45%, #b8cba3 100%)",
    grid: {
      enabled: false,
      lineColor: "#bcc6b0",
      dotColor: "#c7d3b8",
      lineOpacity: { min: 0.2, max: 0.45, scale: 0.3 },
      dotOpacity: { min: 0.2, max: 0.4, scale: 0.25 },
    },
    origin: {
      fill: "rgba(184, 203, 163, 0.95)",
      stroke: "#a8b6a1",
      core: "#9caf8f",
    },
  },
  node: {
    palette: {
      idea: "#a8b6a1",
      argument: "#c2b8a3",
      counter: "#b8cba3",
      reference: "#d9c6a3",
      analogy: "#a3b8b1",
      default: "#cfd9c2",
    },
    backgroundAlpha: 0.22,
    borderAlpha: 0.48,
    textColor: { regular: "#38413c", minimized: "#697265" },
    label: {
      textColor: "#2f3a33",
      background: "rgba(255, 255, 255, 0.78)",
      opacity: 0.85,
      blur: 10,
      letterSpacing: 0.15,
    },
    shadow: {
      default: "0 8px 20px rgba(56, 65, 60, 0.25)",
      highlight: "0 0 30px rgba(184, 203, 163, 0.55)",
    },
    highlightStroke: "#a8b6a1",
    minimizedPalette: [
      "#b8cba3",
      "#c2b8a3",
      "#a8b6a1",
      "#d9c6a3",
      "#a3b8b1",
      "#cfd9c2",
    ],
    opacityLevels: { 0: 1, 1: 0.9, 2: 0.75, 3: 0.58, default: 0.45 },
  },
  lines: {
    default: { stroke: "rgba(168, 182, 161, 0.4)" },
    connected: { stroke: "rgba(184, 203, 163, 0.85)" },
    dimmed: { stroke: "rgba(168, 182, 161, 0.2)" },
    preview: { stroke: "rgba(168, 182, 161, 0.55)", opacity: 0.7 },
  },
  ui: {
    header: {
      background: "rgba(232, 236, 228, 0.82)",
      border: "rgba(184, 203, 163, 0.65)",
      text: "#38413c",
      subtext: "#6c756b",
    },
    sidebar: {
      background: "rgba(255, 255, 255, 0.9)",
      border: "rgba(200, 210, 190, 0.8)",
      headerBackground:
        "linear-gradient(135deg, rgba(243, 245, 238, 0.95) 0%, rgba(219, 227, 211, 0.95) 100%)",
      headerText: "#2f3a33",
      headerSubtext: "#6c756b",
      cardBackground: "rgba(248, 250, 245, 0.9)",
      cardBorder: "rgba(200, 210, 190, 0.9)",
      textPrimary: "#38413c",
      textSecondary: "#4b554f",
      textMuted: "#6c756b",
      inputBackground: "rgba(255, 255, 255, 0.9)",
      inputBorder: "rgba(184, 203, 163, 0.5)",
      inputFocus: "#a8b6a1",
      inputText: "#2f3a33",
    },
    floatingButton: {
      background: "#a8b6a1",
      hover: "#9caf8f",
      text: "#ffffff",
      indicator: "#c2b8a3",
    },
    generateButton: {
      background: "#b8cba3",
      hover: "#a8b6a1",
      text: "#2f3a33",
      indicator: "#c2b8a3",
    },
  },
};

const THEME_REGISTRY: Record<ThemeId, ThemeDefinition> = {
  obsidian: OBSIDIAN_DARK_THEME,
  morandi: MORANDI_THEME,
  sunrise: SUNRISE_THEME
};

const THEME_LIST = Object.values(THEME_REGISTRY);

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ThemeDefinition;
  setTheme: (id: ThemeId) => void;
  themes: ThemeDefinition[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "nodify.active-theme";

export const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) {
    return `rgba(204, 204, 204, ${alpha})`;
  }
  const value = parseInt(sanitized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mountedRef = useRef(false);
  const [themeId, setThemeId] = useState<ThemeId>("sunrise");

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && stored in THEME_REGISTRY) {
      setThemeId(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !mountedRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, themeId);
    document.documentElement.dataset.nodifyTheme = themeId;
  }, [themeId]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme: THEME_REGISTRY[themeId],
      setTheme,
      themes: THEME_LIST,
    }),
    [themeId, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export function Themes() {
  const { themeId, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full border border-transparent p-2 transition-colors hover:border-slate-400/60 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500/70"
        title="Switch theme"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200/70 bg-white/90 shadow-xl backdrop-blur p-3 space-y-2"
        >
          {themes.map((theme) => {
            const isActive = theme.id === themeId;
            const chipBackground = hexToRgba(
              theme.node.palette.idea || theme.node.palette.default,
              isActive ? 0.18 : 0.08
            );
            return (
              <button
                key={theme.id}
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(theme.id);
                  setOpen(false);
                }}
                className="w-full rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500/70"
                style={{
                  background: chipBackground,
                  border: `1px solid ${
                    isActive
                      ? theme.node.highlightStroke ?? theme.node.palette.default
                      : "transparent"
                  }`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {theme.icon}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {theme.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {theme.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {theme.previewColors.map((color) => (
                      <span
                        key={`${theme.id}-${color}`}
                        className="h-4 w-4 rounded-full border border-white/40 shadow"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
