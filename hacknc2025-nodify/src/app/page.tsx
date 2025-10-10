"use client";

import React from "react";
import Canvas from "@/components/Canvas";
import Dashboard from "@/components/Dashboard";
import CompareSection from "@/components/CompareSection";
import { DashboardParams, InfoData } from "@/components/types";
import { AttentionProvider } from "@/components/Attention";

export default function Home() {
  const [open, setOpen] = React.useState(false);
  const [dashboardHovered, setDashboardHovered] = React.useState(false);
  const [params, setParams] = React.useState<DashboardParams>({
    nodeCount: 4,
    phraseLength: 5,
    temperature: 0.7,
  });
  const [info, setInfo] = React.useState<InfoData | null>(null);

  const generateButtonRef = React.useRef<HTMLButtonElement>(null);

  // Reset generate button state when dashboard hover changes
  React.useEffect(() => {
    if (generateButtonRef.current) {
      generateButtonRef.current.style.width = '56px';
      generateButtonRef.current.style.paddingRight = '16px';
    }
  }, [dashboardHovered]);

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 border-b bg-white/70 backdrop-blur sticky top-0 z-40">
        <div className="text-slate-800 font-semibold tracking-tight">Nodify Canvas</div>
        <div className="text-slate-500 text-sm">Be Inspired</div>
      </header>

      <div className="flex-1 flex">
        <main className="flex-1">
          <AttentionProvider>
            <Canvas params={params} onRequestInfo={setInfo} />
          </AttentionProvider>
        </main>
        <CompareSection info={info} />
      </div>

      <Dashboard 
        open={open} 
        onToggle={() => setOpen((v) => !v)} 
        params={params} 
        onChange={setParams}
        onHover={setDashboardHovered}
      />
      
      {/* Generate Button */}
      <button 
        ref={generateButtonRef}
        className="fixed bottom-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden bg-gray-700 hover:bg-gray-800 text-white"
        style={{
          width: '56px',
          height: '56px',
          padding: '16px',
          right: dashboardHovered ? '180px' : '90px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.width = '140px';
          e.currentTarget.style.paddingRight = '20px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = '56px';
          e.currentTarget.style.paddingRight = '16px';
        }}
        aria-label="Generate Ideas"
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Generate
        </span>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
      </button>
    </div>
  );
}
