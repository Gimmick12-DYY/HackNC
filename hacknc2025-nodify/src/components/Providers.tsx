"use client";

import React from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export default function Providers({ children }: { children: React.ReactNode }) {
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: "light",
          primary: { main: "#334155" },
          secondary: { main: "#0ea5e9" },
          background: { default: "#f8fafc" },
        },
        shape: { borderRadius: 10 },
      }),
    []
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

