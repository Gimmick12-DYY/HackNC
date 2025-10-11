"use client";

import React from "react";
import Canvas from "@/components/Canvas";
import Dashboard from "@/components/Dashboard";
import CompareSection from "@/components/CompareSection";
import CollectorPanel from "@/components/CollectorPanel";
import { DashboardParams, DebateRecord, InfoData, NodeItem } from "@/components/types";
import { AttentionProvider } from "@/components/Attention";
import { ThemeProvider, useTheme, Themes, hexToRgba } from "@/components/Themes";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";

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
  const [collectorSelectionMode, setCollectorSelectionMode] = React.useState(false);
  const [collectorItems, setCollectorItems] = React.useState<NodeItem[]>([]);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoWidth, setInfoWidth] = React.useState(320);
  const [debateHistory, setDebateHistory] = React.useState<DebateRecord[]>([]);
  const [debateSummaryOpen, setDebateSummaryOpen] = React.useState(false);
  const debateActionsRef = React.useRef<{ deleteDebate: (id: string) => void } | null>(null);

  const generateButtonRef = React.useRef<HTMLButtonElement>(null);
  const infoButtonRef = React.useRef<HTMLButtonElement>(null);
  const debateButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const debatePopoverRef = React.useRef<HTMLDivElement | null>(null);
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
    if (!infoOpen && info && !prevInfoRef.current) {
      setInfoOpen(true);
    }
    prevInfoRef.current = info;
  }, [info, infoOpen]);

  React.useEffect(() => {
    if (!debateSummaryOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        debatePopoverRef.current &&
        !debatePopoverRef.current.contains(target) &&
        debateButtonRef.current &&
        !debateButtonRef.current.contains(target)
      ) {
        setDebateSummaryOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDebateSummaryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [debateSummaryOpen]);

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

  const handleDebateDelete = React.useCallback(
    (id: string) => {
      debateActionsRef.current?.deleteDebate(id);
    },
    []
  );

  const handleDebateLoad = React.useCallback(
    (debate: DebateRecord) => {
      setInfo({
        mode: "debate",
        rootId: debate.promptNodes[0]?.id ?? null,
        nodes: {},
        edges: [],
        debate,
      });
      setInfoOpen(true);
      setDebateSummaryOpen(false);
    },
    []
  );

  const handleRegisterDebateActions = React.useCallback((actions: { deleteDebate: (id: string) => void }) => {
    debateActionsRef.current = actions;
  }, []);
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
          className="relative text-sm flex items-center gap-3 text-right"
          style={{ color: header.subtext }}
        >
          <span>Be Inspired</span>
          <button
            ref={debateButtonRef}
            type="button"
            onClick={() => setDebateSummaryOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={debateSummaryOpen}
            className="rounded-full border border-transparent p-2 transition-colors hover:border-slate-400/60 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500/70"
            title="Show debate summaries"
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
          <Themes />
          {debateSummaryOpen && (
            <div
              ref={debatePopoverRef}
              role="dialog"
              aria-label="Stored debate summaries"
              className="absolute right-0 top-12 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-xl backdrop-blur p-4 space-y-3"
              style={{
                background: sidebar.cardBackground,
                borderColor: sidebar.cardBorder,
                color: sidebar.textPrimary,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Debate Summaries</div>
                  <div
                    className="text-[11px]"
                    style={{ color: sidebar.textSecondary }}
                  >
                    {debateHistory.length} saved debate
                    {debateHistory.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDebateSummaryOpen(false)}
                  className="text-xs font-medium px-2 py-1 rounded-md border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500/70"
                  style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                >
                  Close
                </button>
              </div>
              {debateHistory.length === 0 ? (
                <p className="text-xs" style={{ color: sidebar.textSecondary }}>
                  No debates yet. Select multiple nodes and choose "Run Debate" to generate one.
                </p>
              ) : (
                <div className="space-y-3">
                  {debateHistory.map((debate) => (
                    <article
                      key={debate.id}
                      className="rounded-xl border px-3 py-3 space-y-2"
                      style={{
                        background: debateCardBackground,
                        borderColor: debateCardBorder,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{debate.topic}</div>
                          <div
                            className="text-[11px]"
                            style={{ color: sidebar.textSecondary }}
                          >
                            Generated {new Date(debate.createdAt).toLocaleString()}
                          </div>
                          <div
                            className="text-[11px] whitespace-nowrap mt-2"
                            style={{ color: sidebar.textSecondary }}
                          >
                            {debate.promptNodes.length} nodes
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDebateLoad(debate)}
                            className="rounded-full p-1.5 border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500/70"
                            style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                            aria-label="Load debate summary"
                            title="Load debate summary"
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
                            onClick={() => handleDebateDelete(debate.id)}
                            className="rounded-full p-1.5 border transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500/70"
                            style={{ borderColor: sidebar.cardBorder, color: sidebar.textSecondary }}
                            aria-label="Delete debate summary"
                            title="Delete debate summary"
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
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: sidebar.textSecondary }}
                      >
                        {debate.summary}
                      </p>
                      {debate.keyInsights.length > 0 && (
                        <div className="space-y-1">
                          <div
                            className="text-[11px] font-medium uppercase tracking-wide"
                            style={{ color: sidebar.textSecondary }}
                          >
                            Key insights
                          </div>
                          <ul className="space-y-1 text-xs" style={{ color: sidebar.textPrimary }}>
                            {debate.keyInsights.slice(0, 3).map((insight, index) => (
                              <li key={`${debate.id}-insight-${index}`} className="flex gap-2">
                                <span aria-hidden>•</span>
                                <span className="flex-1">{insight}</span>
                              </li>
                            ))}
                            {debate.keyInsights.length > 3 && (
                              <li
                                className="text-[11px]"
                                style={{ color: sidebar.textSecondary }}
                              >
                                +{debate.keyInsights.length - 3} more insight
                                {debate.keyInsights.length - 3 === 1 ? "" : "s"}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <AttentionProvider>
            <Canvas
              params={params}
              onRequestInfo={setInfo}
              onDebateHistoryUpdate={setDebateHistory}
              registerDebateActions={handleRegisterDebateActions}
              onCollectorToggleSelect={() => setCollectorSelectionMode((v) => !v)}
              collectorSelectionMode={collectorSelectionMode}
              onCollectorPickNode={(n) => setCollectorItems((items) => items.some((i) => i.id === n.id) ? items : [...items, n])}
            />
          </AttentionProvider>
        </main>
        {infoOpen && !collectorOpen && (
          <CompareSection
            info={info}
            width={infoWidth}
            onResize={setInfoWidth}
            onClose={() => setInfoOpen(false)}
          />
        )}
        {collectorOpen && (
          <CollectorPanel
            width={collectorWidth}
            onResize={setCollectorWidth}
            onClose={() => setCollectorOpen(false)}
            items={collectorItems}
            selectionMode={collectorSelectionMode}
            onToggleSelectionMode={() => setCollectorSelectionMode((v) => !v)}
          />
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
