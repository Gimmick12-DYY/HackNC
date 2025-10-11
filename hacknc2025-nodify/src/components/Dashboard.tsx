"use client";

import React from "react";
import { Slider } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import { DashboardParams } from "./types";
import { useTheme } from "./Themes";

type Props = {
  open: boolean;
  onToggle: () => void;
  params: DashboardParams;
  onChange: (p: DashboardParams) => void;
  onHover?: (hovered: boolean) => void;
  buttonRight?: number;
  buttonBottom?: number;
};

export default function Dashboard({
  open,
  onToggle,
  params,
  onChange,
  onHover,
  buttonRight = 24,
  buttonBottom = 24,
}: Props) {
  const { theme } = useTheme();
  const floatingButton = theme.ui.floatingButton;
  const sidebar = theme.ui.sidebar;
  return (
    <>
      {/* Floating Dashboard Button - Expands on Hover */}
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group overflow-hidden"
        style={{
          background: open ? floatingButton.hover : floatingButton.background,
          color: floatingButton.text,
          width: "56px",
          height: "56px",
          padding: "16px",
          right: `${buttonRight}px`,
          bottom: `${buttonBottom}px`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.width = "140px";
          e.currentTarget.style.paddingRight = "20px";
          e.currentTarget.style.background = floatingButton.hover;
          onHover?.(true);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = "56px";
          e.currentTarget.style.paddingRight = "16px";
          e.currentTarget.style.background = open
            ? floatingButton.hover
            : floatingButton.background;
          onHover?.(false);
        }}
        aria-label={open ? "Close Dashboard" : "Open Dashboard"}
      >
        <DashboardRoundedIcon className="text-xl flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {open ? "Close" : "Dashboard"}
        </span>
        {!open && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: floatingButton.indicator }}
          ></div>
        )}
      </button>

      {open && (
        <div
          className="fixed flex flex-col items-end gap-5 z-40"
          style={{
            right: `${buttonRight}px`,
            bottom: `${buttonBottom + 80}px`,
          }}
        >
          <div className="flex flex-row-reverse items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-full text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
              style={{
                background: floatingButton.background,
                color: floatingButton.text,
              }}
            >
              🧮
            </button>
            <div
              className="rounded-2xl shadow-xl px-4 py-3 w-60 border"
              style={{
                background: sidebar.cardBackground,
                borderColor: sidebar.cardBorder,
              }}
            >
              <div
                className="flex items-center justify-between text-sm font-medium mb-2"
                style={{ color: sidebar.textPrimary }}
              >
                <span>Node Count</span>
                <span style={{ color: sidebar.textMuted }}>
                  {params.nodeCount}
                </span>
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
              className="w-14 h-14 rounded-full text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
              style={{
                background: floatingButton.background,
                color: floatingButton.text,
              }}
            >
              🔡
            </button>
            <div
              className="rounded-2xl shadow-xl px-4 py-3 w-60 border"
              style={{
                background: sidebar.cardBackground,
                borderColor: sidebar.cardBorder,
              }}
            >
              <div
                className="flex items-center justify-between text-sm font-medium mb-2"
                style={{ color: sidebar.textPrimary }}
              >
                <span>Phrase Length</span>
                <span style={{ color: sidebar.textMuted }}>
                  {params.phraseLength}
                </span>
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
              className="w-14 h-14 rounded-full text-xl flex items-center justify-center shadow-lg"
              aria-hidden
              tabIndex={-1}
              style={{
                background: floatingButton.background,
                color: floatingButton.text,
              }}
            >
              🔥
            </button>
            <div
              className="rounded-2xl shadow-xl px-4 py-3 w-60 border"
              style={{
                background: sidebar.cardBackground,
                borderColor: sidebar.cardBorder,
              }}
            >
              <div
                className="flex items-center justify-between text-sm font-medium mb-2"
                style={{ color: sidebar.textPrimary }}
              >
                <span>Temperature</span>
                <span style={{ color: sidebar.textMuted }}>
                  {params.temperature.toFixed(2)}
                </span>
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
