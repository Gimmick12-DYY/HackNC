"use client";

import React from "react";
import { Drawer, IconButton, Slider, TextField, Typography, Box } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { DashboardParams } from "./types";

type Props = {
  open: boolean;
  onToggle: () => void;
  params: DashboardParams;
  onChange: (p: DashboardParams) => void;
};

export default function Dashboard({ open, onToggle, params, onChange }: Props) {
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
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.width = '56px';
          e.currentTarget.style.paddingRight = '16px';
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

      <Drawer anchor="right" open={open} onClose={onToggle}>
        <Box sx={{ width: 340, p: 3 }} role="presentation">
          <div className="flex items-center justify-between mb-2">
            <Typography variant="h6">Dashboard</Typography>
            <IconButton onClick={onToggle}>
              <CloseRoundedIcon />
            </IconButton>
          </div>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            Control how many subnodes get generated and their style.
          </Typography>

          <div className="space-y-6">
            <div>
              <Typography gutterBottom>Node count: {params.nodeCount}</Typography>
              <Slider
                value={params.nodeCount}
                onChange={(_, v) => onChange({ ...params, nodeCount: v as number })}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div>
              <Typography gutterBottom>
                Approx. phrase length: {params.phraseLength}
              </Typography>
              <Slider
                value={params.phraseLength}
                onChange={(_, v) => onChange({ ...params, phraseLength: v as number })}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div>
              <Typography gutterBottom>Temperature: {params.temperature.toFixed(2)}</Typography>
              <Slider
                value={params.temperature}
                onChange={(_, v) => onChange({ ...params, temperature: v as number })}
                min={0}
                max={2}
                step={0.05}
              />
            </div>

            <TextField
              size="small"
              label="OpenRouter API Key"
              placeholder="Use env var on server"
              value={""}
              disabled
              helperText="Set OPENROUTER_API_KEY in your environment"
              fullWidth
            />
          </div>
        </Box>
      </Drawer>
    </>
  );
}
