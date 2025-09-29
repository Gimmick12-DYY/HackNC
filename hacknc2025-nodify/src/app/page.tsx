"use client";

import React from "react";
import Canvas from "@/components/Canvas";
import Dashboard from "@/components/Dashboard";
import { DashboardParams } from "@/components/types";

export default function Home() {
  const [open, setOpen] = React.useState(true);
  const [params, setParams] = React.useState<DashboardParams>({
    nodeCount: 4,
    phraseLength: 40,
    temperature: 0.7,
  });

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 border-b bg-white/70 backdrop-blur sticky top-0 z-40">
        <div className="text-slate-800 font-semibold tracking-tight">Nodify Canvas</div>
        <div className="text-slate-500 text-sm">Next.js + Tailwind + MUI + OpenRouter</div>
      </header>

      <main className="flex-1">
        <Canvas params={params} />
      </main>

      <Dashboard open={open} onToggle={() => setOpen((v) => !v)} params={params} onChange={setParams} />
    </div>
  );
}
