"use client";

import React from "react";
import Canvas from "@/components/Canvas";
import Dashboard from "@/components/Dashboard";
import CompareSection from "@/components/CompareSection";
import CollectorPanel from "@/components/CollectorPanel";
import {
  DashboardParams,
  InfoData,
  CollectorState,
  CollectorMode,
  ThoughtEntry,
  NodeItem,
} from "@/components/types";
import { AttentionProvider } from "@/components/Attention";
import { ThemeProvider, useTheme, Themes, hexToRgba } from "@/components/Themes";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import dynamic from "next/dynamic";
const BackgroundFX = dynamic(() => import("@/components/BackgroundFX"), { ssr: false });

const MODE_LABELS: Record<CollectorMode, string> = {
  argument: "Argument",
  counter: "Anti-Argument",
  script: "Script",
  debate: "Debate",
};

const DEFAULT_FIELD_BY_MODE: Record<CollectorMode, CollectorState["target"]["field"]> = {
  argument: "evidence",
  counter: "main",
  script: "outline",
  debate: "participants",
};

function HomeContent() {
  const { theme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [params, setParams] = React.useState<DashboardParams>({
    nodeCount: 4,
    phraseLength: 5,
    temperature: 0.7,
  });
  const [info, setInfo] = React.useState<InfoData | null>(null);
  const [collectorOpen, setCollectorOpen] = React.useState(false);
  const [collectorWidth, setCollectorWidth] = React.useState(360);
  const defaultCollectorState: CollectorState = {
    argument: { main: null, evidences: [] },
    counter: { main: null, evidences: [] },
    script: { outline: [] },
    debate: { participants: [] },
    target: { section: 'argument', field: 'evidence' },
    pool: [],
  };
  const [collector, setCollector] = React.useState<CollectorState>(defaultCollectorState);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoWidth, setInfoWidth] = React.useState(320);
  const [thoughtHistory, setThoughtHistory] = React.useState<ThoughtEntry[]>([]);
  const [activeThoughtId, setActiveThoughtId] = React.useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [canvasActions, setCanvasActions] = React.useState<{ openClearConfirm: () => void } | null>(null);
  const handleRegisterCanvasActions = React.useCallback(
    (actions: { openClearConfirm: () => void } | null) => {
      setCanvasActions(actions);
    },
    []
  );

  const generateButtonRef = React.useRef<HTMLButtonElement>(null);
  const infoButtonRef = React.useRef<HTMLButtonElement>(null);
  const historyButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const historyPopoverRef = React.useRef<HTMLDivElement | null>(null);

  const handleRecordThought = React.useCallback((entry: ThoughtEntry) => {
    setThoughtHistory((prev) => [entry, ...prev]);
    setActiveThoughtId(entry.id);
  }, []);

  const handleSelectOutput = React.useCallback((id: string) => {
    setActiveThoughtId(id);
  }, []);

  const handleAssignCollectorNode = React.useCallback((node: NodeItem) => {
    setCollector((prev) => {
      // Check if node already exists anywhere in the collector
      const existsInPool = prev.pool.some((item) => item.id === node.id);
      if (existsInPool) {
        return prev;
      }

      // Clone the node to avoid mutation issues
      const clone: NodeItem = {
        ...node,
        children: [...node.children],
      };

      // Remove the node from any other location
      const strip = (items: NodeItem[]) => items.filter((item) => item.id !== node.id);

      return {
        argument: {
          main: prev.argument.main?.id === node.id ? null : prev.argument.main,
          evidences: strip(prev.argument.evidences),
        },
        counter: {
          main: prev.counter.main?.id === node.id ? null : prev.counter.main,
          evidences: strip(prev.counter.evidences),
        },
        script: {
          outline: strip(prev.script.outline),
        },
        debate: {
          participants: strip(prev.debate.participants),
        },
        target: prev.target,
        pool: [clone, ...prev.pool],
      };
    });
    setCollectorOpen(true);
  }, []);

  const handleHistoryDelete = React.useCallback((id: string) => {
    setThoughtHistory((prev) => prev.filter((entry) => entry.id !== id));
    setActiveThoughtId((current) => (current === id ? null : current));
  }, []);

  const handleHistoryLoad = React.useCallback(
    (entry: ThoughtEntry) => {
      setCollector((prev) => ({
        ...prev,
        target: {
          section: entry.mode,
          field: DEFAULT_FIELD_BY_MODE[entry.mode],
        },
      }));
      setActiveThoughtId(entry.id);
      setCollectorOpen(true);
      setHistoryOpen(false);
    },
    [setCollectorOpen, setCollector]
  );
  const prevInfoRef = React.useRef<InfoData | null>(null);

  React.useEffect(() => {
    if (generateButtonRef.current) {
      generateButtonRef.current.style.width = "56px";
      generateButtonRef.current.style.paddingRight = "16px";
    }
  }, []);

  React.useEffect(() => {
    if (infoButtonRef.current) {
      infoButtonRef.current.style.width = "56px";
      infoButtonRef.current.style.paddingRight = "16px";
    }
  }, [infoOpen]);

  React.useEffect(() => {
    if (info && info !== prevInfoRef.current) {
      setInfoOpen(true);
    }
    prevInfoRef.current = info;
  }, [info]);

  React.useEffect(() => {
    if (!historyOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        historyPopoverRef.current &&
        !historyPopoverRef.current.contains(target) &&
        historyButtonRef.current &&
        !historyButtonRef.current.contains(target)
      ) {
        setHistoryOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [historyOpen]);

  const header = theme.ui.header;
  const generateButton = theme.ui.generateButton;
  const floatingButton = theme.ui.floatingButton;
  const activePanelWidth = collectorOpen ? collectorWidth : (infoOpen ? infoWidth : 0);
  const stackRight = (collectorOpen || infoOpen) ? activePanelWidth + 32 : 24;
  const baseBottom = 24;
  const buttonSpacing = 72;
  const dashboardBottom = baseBottom;
  const infoBottom = baseBottom + buttonSpacing;
  const generateBottom = baseBottom + buttonSpacing * 2;
  const sidebar = theme.ui.sidebar;
  const debateCardBackground = hexToRgba(theme.node.palette.default, 0.08);
  const debateCardBorder = hexToRgba(theme.node.palette.default, 0.18);
  const clearButtonHover = generateButton.hover ?? generateButton.background;
  const clearButtonBorder = hexToRgba(generateButton.text, 0.18);
  const clearButtonDisabledBackground = hexToRgba(header.subtext, 0.12);
  const clearButtonDisabledColor = hexToRgba(header.subtext, 0.6);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: theme.canvas.background,
        transition: "background 0.6s ease",
      }}
    >
      <header
        className="h-16 flex items-center justify-between px-6 border-b backdrop-blur sticky top-0 z-40"
        style={{
          background: header.background,
          borderBottomColor: header.border,
        }}
      >
        <div
          className="font-semibold tracking-tight text-base sm:text-lg"
          style={{ color: header.text }}
        >
          Nodify
        </div>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-center"
          style={{ color: header.text, pointerEvents: 'none' }}
        >
          <span className="inline-block text-[13px] sm:text-base font-medium tracking-wide" style={{ opacity: 0.9, fontFamily: 'var(--font-playfair)' }}>
            Everything has a link
          </span>
        </div>
        <div
          className="relative text-sm flex items-center gap-3 text-right"
          style={{ color: header.subtext }}
        >
          <span>Be Inspired</span>
          <button
            ref={historyButtonRef}
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={historyOpen}
            className="rounded-full border border-transparent p-2 transition-colors hover:border-slate-400/60 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500/70"
            title="Show thinking history"
            style={{ color: header.text }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => canvasActions?.openClearConfirm()}
            aria-label="Clear canvas"
            title="Clear canvas"
            disabled={!canvasActions}
            className="rounded-full border px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{
              color: canvasActions ? generateButton.text : clearButtonDisabledColor,
              borderColor: canvasActions ? clearButtonBorder : clearButtonDisabledColor,
              background: canvasActions ? generateButton.background : clearButtonDisabledBackground,
            }}
            onMouseEnter={(event) => {
              if (!canvasActions) return;
              event.currentTarget.style.background = clearButtonHover;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = canvasActions ? generateButton.background : clearButtonDisabledBackground;
            }}
            onFocus={(event) => {
              if (!canvasActions) return;
              event.currentTarget.style.background = clearButtonHover;
            }}
            onBlur={(event) => {
              event.currentTarget.style.background = canvasActions ? generateButton.background : clearButtonDisabledBackground;
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
          <Themes />
          {historyOpen && (
            <div
              ref={historyPopoverRef}
              role="dialog"
              aria-label="Thinking history"
              className="absolute right-0 top-12 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-xl backdrop-blur p-4 space-y-3"
              style={{
                background: sidebar.cardBackground,
                borderColor: sidebar.cardBorder,
                color: sidebar.textPrimary,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Thinking history</div>
                  <div className="text-[11px]" style={{ color: sidebar.textSecondary }}>
                    {thoughtHistory.length} saved {thoughtHistory.length === 1 ? "entry" : "entries"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="text-xs font-medium px-2 py-1 rounded-md border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500/70"
                  style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                >
                  Close
                </button>
              </div>
              {thoughtHistory.length === 0 ? (
                <p className="text-xs" style={{ color: sidebar.textSecondary }}>
                  No thoughts captured yet. Generate an argument, counterpoint, script, or debate to see it here.
                </p>
              ) : (
                <div className="space-y-3">
                  {thoughtHistory.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border px-3 py-3 space-y-2"
                      style={{
                        background: debateCardBackground,
                        borderColor: debateCardBorder,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-semibold">{entry.title}</div>
                          <div className="text-[11px]" style={{ color: sidebar.textSecondary }}>
                            {MODE_LABELS[entry.mode]} - {new Date(entry.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleHistoryLoad(entry)}
                            className="rounded-full p-1.5 border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500/70"
                            style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                            aria-label="Load entry into collector"
                            title="Load entry into collector"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-4 h-4"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.75 9h16.5m-16.5 6.75h16.5"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHistoryDelete(entry.id)}
                            className="rounded-full p-1.5 border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500/70"
                            style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                            aria-label="Delete entry"
                            title="Delete entry"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-4 h-4"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {entry.mode === "debate" && entry.debate ? (
                        <div className="space-y-1 text-xs" style={{ color: sidebar.textSecondary }}>
                          <div className="font-medium">Summary</div>
                          <p>{entry.debate.summary}</p>
                          <div className="font-medium mt-2">Key insights</div>
                          <ul className="list-disc list-inside space-y-1" style={{ color: sidebar.textPrimary }}>
                            {entry.debate.keyInsights.slice(0, 3).map((insight, index) => (
                              <li key={`${entry.id}-insight-${index}`}>{insight}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed" style={{ color: sidebar.textSecondary }}>
                          {entry.content?.slice(0, 220) ?? ""}
                          {entry.content && entry.content.length > 220 ? "..." : ""}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{ zIndex: 0 }}>
            <BackgroundFX />
          </div>
          <AttentionProvider>
            <Canvas
              params={params}
              onRequestInfo={setInfo}
              registerCanvasActions={handleRegisterCanvasActions}
              onCollectorAdd={handleAssignCollectorNode}
            />
          </AttentionProvider>
        </main>
        {infoOpen && !collectorOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-10">
            <CompareSection
              info={info}
              width={infoWidth}
              onResize={setInfoWidth}
              onClose={() => setInfoOpen(false)}
            />
          </div>
        )}
        {collectorOpen && (
          <div className="absolute top-0 right-0 bottom-0 z-10">
            <CollectorPanel
              width={collectorWidth}
              onResize={setCollectorWidth}
              onClose={() => setCollectorOpen(false)}
              state={collector}
              onChangeState={setCollector}
              outputs={thoughtHistory}
              activeOutputId={activeThoughtId}
              onRecordOutput={handleRecordThought}
              onSelectOutput={handleSelectOutput}
            />
          </div>
        )}
      </div>

      <Dashboard
        open={open}
        onToggle={() => setOpen((v) => !v)}
        params={params}
        onChange={setParams}
        buttonRight={stackRight}
        buttonBottom={dashboardBottom}
      />

      <button
        ref={generateButtonRef}
        className="fixed bottom-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden"
        style={{
          background: collectorOpen ? generateButton.hover : generateButton.background,
          color: generateButton.text,
          width: "56px",
          height: "56px",
          padding: "16px",
          right: `${stackRight}px`,
          bottom: `${generateBottom}px`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.width = "140px";
          e.currentTarget.style.paddingRight = "20px";
          e.currentTarget.style.background = generateButton.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = "56px";
          e.currentTarget.style.paddingRight = "16px";
          e.currentTarget.style.background = collectorOpen ? generateButton.hover : generateButton.background;
        }}
        aria-label={collectorOpen ? "Close Collector" : "Open Collector"}
        onClick={() => {
          setCollectorOpen((v) => !v);
          if (!collectorOpen) setInfoOpen(false);
        }}
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {collectorOpen ? "Close" : "Generate"}
        </span>
        {!collectorOpen && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: generateButton.indicator }} />
        )}
      </button>
      <button
        ref={infoButtonRef}
        onClick={() => {
          setInfoOpen((v) => !v);
          if (!infoOpen) setCollectorOpen(false);
        }}
        className="fixed z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden"
        style={{
          background: infoOpen ? floatingButton.hover : floatingButton.background,
          color: floatingButton.text,
          width: "56px",
          height: "56px",
          padding: "16px",
          right: `${stackRight}px`,
          bottom: `${infoBottom}px`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.width = "140px";
          e.currentTarget.style.paddingRight = "20px";
          e.currentTarget.style.background = floatingButton.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = "56px";
          e.currentTarget.style.paddingRight = "16px";
          e.currentTarget.style.background = infoOpen
            ? floatingButton.hover
            : floatingButton.background;
        }}
        aria-label={infoOpen ? "Hide Info Panel" : "Show Info Panel"}
      >
        <InfoRoundedIcon className="text-xl flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {infoOpen ? "Close" : "Info"}
        </span>
        {!infoOpen && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: floatingButton.indicator }}
          ></div>
        )}
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  );
}



