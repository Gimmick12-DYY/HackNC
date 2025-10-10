"use client";

import React from "react";
import { Slider } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import { DashboardParams } from "./types";

type Props = {
  open: boolean;
  onToggle: () => void;
  params: DashboardParams;
  onChange: (p: DashboardParams) => void;
  onHover?: (hovered: boolean) => void;
};

export default function Dashboard({ open, onToggle, params, onChange, onHover }: Props) {
  return (
    <>
      {/* Floating Dashboard Button - Expands on Hover */}
      <button
        onClick={onToggle}
        className={`fixed bottom-6 right-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden ${
          open 
            ? "bg-gray-600 hover:bg-gray-700 text-white" 
            : "bg-gray-700 hover:bg-gray-800 text-white"
        }`}
        style={{
          width: '56px',
          height: '56px',
          padding: '16px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.width = '140px';
          e.currentTarget.style.paddingRight = '20px';
          onHover?.(true);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = '56px';
          e.currentTarget.style.paddingRight = '16px';
          onHover?.(false);
        }}
        aria-label={open ? "Close Dashboard" : "Open Dashboard"}
      >
        <DashboardRoundedIcon className="text-xl flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {open ? "Close" : "Dashboard"}
        </span>
        {!open && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 flex flex-col items-end gap-5 z-40">
          <div className="flex flex-row-reverse items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
            >
              🧮
            </button>
            <div className="bg-white rounded-2xl shadow-xl px-4 py-3 w-60 border border-slate-200">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Node Count</span>
                <span className="text-slate-500">{params.nodeCount}</span>
              </div>
              <Slider
                value={params.nodeCount}
                onChange={(_, v) => onChange({ ...params, nodeCount: v as number })}
                min={1}
                max={10}
                step={1}
                size="small"
              />
            </div>
          </div>
          <div className="flex flex-row-reverse items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
            >
              🔡
            </button>
            <div className="bg-white rounded-2xl shadow-xl px-4 py-3 w-60 border border-slate-200">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Phrase Length</span>
                <span className="text-slate-500">{params.phraseLength}</span>
              </div>
              <Slider
                value={params.phraseLength}
                onChange={(_, v) => onChange({ ...params, phraseLength: v as number })}
                min={1}
                max={10}
                step={1}
                size="small"
              />
            </div>
          </div>
          <div className="flex flex-row-reverse items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
            >
              🔥
            </button>
            <div className="bg-white rounded-2xl shadow-xl px-4 py-3 w-60 border border-slate-200">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                <span>Temperature</span>
                <span className="text-slate-500">{params.temperature.toFixed(2)}</span>
              </div>
              <Slider
                value={params.temperature}
                onChange={(_, v) => onChange({ ...params, temperature: v as number })}
                min={0}
                max={2}
                step={0.05}
                size="small"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
