"use client";

import React from "react";
import Canvas from "@/components/Canvas";
import Dashboard from "@/components/Dashboard";
import CompareSection from "@/components/CompareSection";
import { DashboardParams, InfoData } from "@/components/types";
import { AttentionProvider } from "@/components/Attention";
import { ThemeProvider, useTheme, Themes } from "@/components/Themes";
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
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoWidth, setInfoWidth] = React.useState(320);

  const generateButtonRef = React.useRef<HTMLButtonElement>(null);
  const infoButtonRef = React.useRef<HTMLButtonElement>(null);
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

  const header = theme.ui.header;
  const generateButton = theme.ui.generateButton;
  const floatingButton = theme.ui.floatingButton;
  const stackRight = infoOpen ? infoWidth + 32 : 24;
  const baseBottom = 24;
  const buttonSpacing = 72;
  const dashboardBottom = baseBottom;
  const infoBottom = baseBottom + buttonSpacing;
  const generateBottom = baseBottom + buttonSpacing * 2;

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
          className="text-sm flex items-center gap-3 text-right"
          style={{ color: header.subtext }}
        >
          <span>Be Inspired</span>
          <Themes />
        </div>
      </header>

      <div className="flex-1 flex">
        <main className="flex-1">
          <AttentionProvider>
            <Canvas params={params} onRequestInfo={setInfo} />
          </AttentionProvider>
        </main>
        {infoOpen && (
          <CompareSection
            info={info}
            width={infoWidth}
            onResize={setInfoWidth}
            onClose={() => setInfoOpen(false)}
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
          background: generateButton.background,
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
          e.currentTarget.style.background = generateButton.background;
        }}
        aria-label="Generate Ideas"
      >
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Generate
        </span>
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
          style={{ backgroundColor: generateButton.indicator }}
        ></div>
      </button>
      <button
        ref={infoButtonRef}
        onClick={() => setInfoOpen((v) => !v)}
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
