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

export type ThemeId = "sunrise" | "midnight" | "aurora";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  previewColors: string[];
  canvas: {
    background: string;
    grid: {
      lineColor: string;
      dotColor: string;
      lineOpacity: ThemeOpacityRange;
      dotOpacity: ThemeOpacityRange;
    };
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

const SUNRISE_THEME: ThemeDefinition = {
  id: "sunrise",
  name: "Golden Grid",
  icon: "🌞",
  description: "Warm daylight gradient with calm technicolor nodes.",
  previewColors: ["#f7b731", "#6c63ff", "#00bfa6"],
  canvas: {
    background: "linear-gradient(135deg, #f7f2e8 0%, #f3eadb 100%)",
    grid: {
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

const MIDNIGHT_THEME: ThemeDefinition = {
  id: "midnight",
  name: "Midnight Glow",
  icon: "🌙",
  description: "Dark mode grid layered with neon attention cues.",
  previewColors: ["#38bdf8", "#a855f7", "#f472b6"],
  canvas: {
    background:
      "radial-gradient(140% 140% at 15% 20%, #1e293b 0%, #0f172a 50%, #020617 100%)",
    grid: {
      lineColor: "#334155",
      dotColor: "#1e293b",
      lineOpacity: { min: 0.32, max: 0.6, scale: 0.28 },
      dotOpacity: { min: 0.28, max: 0.5, scale: 0.3 },
    },
    origin: {
      fill: "rgba(56, 189, 248, 0.9)",
      stroke: "#38bdf8",
      core: "#0ea5e9",
    },
  },
  node: {
    palette: {
      idea: "#38bdf8",
      argument: "#f472b6",
      counter: "#34d399",
      reference: "#eab308",
      analogy: "#a855f7",
      default: "#7dd3fc",
    },
    backgroundAlpha: 0.2,
    borderAlpha: 0.55,
    textColor: { regular: "#f8fafc", minimized: "#0f172a" },
    label: {
      textColor: "#e2e8f0",
      background: "rgba(15, 23, 42, 0.86)",
      opacity: 0.86,
      blur: 12,
      letterSpacing: 0.2,
    },
    shadow: {
      default: "0 12px 26px rgba(2, 6, 23, 0.55)",
      highlight: "0 0 36px rgba(56, 189, 248, 0.7)",
    },
    highlightStroke: "#38bdf8",
    minimizedPalette: [
      "#38bdf8",
      "#f472b6",
      "#34d399",
      "#eab308",
      "#a855f7",
      "#22d3ee",
    ],
    opacityLevels: { 0: 1, 1: 0.88, 2: 0.72, 3: 0.55, default: 0.4 },
  },
  lines: {
    default: { stroke: "rgba(37, 99, 235, 0.35)" },
    connected: { stroke: "rgba(56, 189, 248, 0.85)" },
    dimmed: { stroke: "rgba(30, 58, 138, 0.18)" },
    preview: { stroke: "rgba(125, 211, 252, 0.55)", opacity: 0.75 },
  },
  ui: {
    header: {
      background: "rgba(15, 23, 42, 0.82)",
      border: "rgba(51, 65, 85, 0.75)",
      text: "#f8fafc",
      subtext: "#94a3b8",
    },
    sidebar: {
      background: "rgba(15, 23, 42, 0.78)",
      border: "rgba(51, 65, 85, 0.8)",
      headerBackground:
        "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)",
      headerText: "#e2e8f0",
      headerSubtext: "#94a3b8",
      cardBackground: "rgba(15, 23, 42, 0.85)",
      cardBorder: "rgba(51, 65, 85, 0.9)",
      textPrimary: "#e2e8f0",
      textSecondary: "#cbd5f5",
      textMuted: "#94a3b8",
      inputBackground: "rgba(15, 23, 42, 0.9)",
      inputBorder: "rgba(56, 189, 248, 0.4)",
      inputFocus: "#38bdf8",
      inputText: "#f8fafc",
    },
    floatingButton: {
      background: "#1f2937",
      hover: "#0f172a",
      text: "#e2e8f0",
      indicator: "#f87171",
    },
    generateButton: {
      background: "#38bdf8",
      hover: "#0ea5e9",
      text: "#0f172a",
      indicator: "#22d3ee",
    },
  },
};

const AURORA_THEME: ThemeDefinition = {
  id: "aurora",
  name: "Aurora Pulse",
  icon: "🚀",
  description: "Electric synthwave gradient made for AI explorations.",
  previewColors: ["#22d3ee", "#a855f7", "#f97316"],
  canvas: {
    background:
      "linear-gradient(120deg, #0ea5e9 0%, #312e81 40%, #7c3aed 70%, #a855f7 100%)",
    grid: {
      lineColor: "#1f2937",
      dotColor: "#0f172a",
      lineOpacity: { min: 0.28, max: 0.6, scale: 0.34 },
      dotOpacity: { min: 0.2, max: 0.5, scale: 0.33 },
    },
    origin: {
      fill: "rgba(236, 72, 153, 0.9)",
      stroke: "#ec4899",
      core: "#f472b6",
    },
  },
  node: {
    palette: {
      idea: "#22d3ee",
      argument: "#f97316",
      counter: "#34d399",
      reference: "#facc15",
      analogy: "#c084fc",
      default: "#e0f2fe",
    },
    backgroundAlpha: 0.18,
    borderAlpha: 0.5,
    textColor: { regular: "#0f172a", minimized: "#0f172a" },
    label: {
      textColor: "#0f172a",
      background: "rgba(248, 250, 252, 0.92)",
      opacity: 0.92,
      blur: 10,
      letterSpacing: 0.15,
    },
    shadow: {
      default: "0 10px 24px rgba(15, 23, 42, 0.3)",
      highlight: "0 0 34px rgba(236, 72, 153, 0.45)",
    },
    highlightStroke: "#ec4899",
    minimizedPalette: [
      "#22d3ee",
      "#38bdf8",
      "#a855f7",
      "#f97316",
      "#facc15",
      "#34d399",
    ],
    opacityLevels: { 0: 1, 1: 0.9, 2: 0.75, 3: 0.58, default: 0.48 },
  },
  lines: {
    default: { stroke: "rgba(14, 165, 233, 0.4)" },
    connected: { stroke: "rgba(236, 72, 153, 0.9)" },
    dimmed: { stroke: "rgba(14, 165, 233, 0.18)" },
    preview: { stroke: "rgba(236, 72, 153, 0.65)", opacity: 0.7 },
  },
  ui: {
    header: {
      background: "rgba(15, 23, 42, 0.55)",
      border: "rgba(99, 102, 241, 0.6)",
      text: "#f8fafc",
      subtext: "#e0f2fe",
    },
    sidebar: {
      background: "rgba(15, 23, 42, 0.7)",
      border: "rgba(99, 102, 241, 0.45)",
      headerBackground:
        "linear-gradient(120deg, rgba(14, 165, 233, 0.75) 0%, rgba(30, 64, 175, 0.75) 100%)",
      headerText: "#f8fafc",
      headerSubtext: "#e0f2fe",
      cardBackground: "rgba(15, 23, 42, 0.8)",
      cardBorder: "rgba(99, 102, 241, 0.6)",
      textPrimary: "#f8fafc",
      textSecondary: "#e0f2fe",
      textMuted: "#cbd5f5",
      inputBackground: "rgba(15, 23, 42, 0.82)",
      inputBorder: "rgba(236, 72, 153, 0.45)",
      inputFocus: "#ec4899",
      inputText: "#f8fafc",
    },
    floatingButton: {
      background: "#312e81",
      hover: "#1e1b4b",
      text: "#f8fafc",
      indicator: "#f472b6",
    },
    generateButton: {
      background: "#ec4899",
      hover: "#db2777",
      text: "#f8fafc",
      indicator: "#22d3ee",
    },
  },
};

const THEME_REGISTRY: Record<ThemeId, ThemeDefinition> = {
  sunrise: SUNRISE_THEME,
  midnight: MIDNIGHT_THEME,
  aurora: AURORA_THEME,
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
