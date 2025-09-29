"use client";

import React from "react";
import { Drawer, IconButton, Slider, TextField, Typography, Box } from "@mui/material";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
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
      <IconButton
        aria-label="open settings"
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-white/80 hover:bg-white shadow-md"
        size="large"
      >
        <SettingsRoundedIcon />
      </IconButton>

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
