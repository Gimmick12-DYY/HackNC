"use client";

import React from "react";
import { useTheme, hexToRgba } from "./Themes";

type Meteor = { left: number; top: number; length: number; delay: number; duration: number; hue: number };
type Speck = { left: number; top: number; size: number; delay: number; duration: number; opacity: number };

export default function BackgroundFX() {
  const { themeId, theme } = useTheme();

  // Compute visual elements once per themeId so Hooks aren't called conditionally.
  // Using a single memo ensures stable ordering and regenerates randomness on theme change.
  const fx = React.useMemo(() => {
    if (themeId === "obsidian") {
      const count = 28;
      // Halton sequence for more even 2D distribution
      const halton = (index: number, base: number) => {
        let f = 1, r = 0;
        while (index > 0) {
          f = f / base;
          r = r + f * (index % base);
          index = Math.floor(index / base);
        }
        return r;
      };
      const meteors: Meteor[] = [];
      for (let i = 1; i <= count; i += 1) {
        const u = halton(i, 2); // 0..1
        const v = halton(i, 3); // 0..1
        const jitterX = (Math.random() - 0.5) * 6; // small jitter for natural look
        const jitterY = (Math.random() - 0.5) * 6;
        meteors.push({
          left: Math.min(100, Math.max(0, u * 100 + jitterX)),
          top: Math.min(55, Math.max(5, v * 55 + jitterY)),
          length: 200 + Math.random() * 220,
          delay: Math.random() * 6,
          duration: 3.6 + Math.random() * 4.2,
          hue: Math.random() < 0.5 ? 195 : 260,
        });
      }
      return { kind: "meteors" as const, meteors };
    }

    if (themeId === "sunrise") {
      const shafts = [
        { rot: -22, left: "12%", width: 160, opacity: 0.22, anim: 10 },
        { rot: -8, left: "40%", width: 200, opacity: 0.16, anim: 12 },
        { rot: 15, left: "72%", width: 180, opacity: 0.2, anim: 14 },
      ];
      return { kind: "shafts" as const, shafts };
    }

    if (themeId === "morandi") {
      const count = 24;
      const specks: Speck[] = Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: 65 + Math.random() * 35,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 8,
        duration: 14 + Math.random() * 10,
        opacity: 0.18 + Math.random() * 0.25,
      }));
      return { kind: "specks" as const, specks };
    }

    // Default fallback: floating specks
    {
      const count = 22;
      const specks: Speck[] = Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: 60 + Math.random() * 40,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 8,
        duration: 12 + Math.random() * 10,
        opacity: 0.15 + Math.random() * 0.25,
      }));
      return { kind: "specks" as const, specks };
    }
  }, [themeId]);

  // Theme-derived colors (not hooks)
  const glow = theme.node.highlightStroke ?? theme.node.palette.default;
  const beam = hexToRgba(theme.node.palette.default, 0.85);
  const dust = theme.node.palette.idea || "#7fb27d";

  if (fx.kind === "meteors") {
    return (
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        {fx.meteors.map((m, idx) => (
          <span
            key={`meteor-${idx}`}
            className="meteor"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.length}px`,
              background: `linear-gradient(90deg, hsla(${m.hue},80%,70%,0) 0%, hsla(${m.hue},80%,70%,0.9) 35%, hsla(${m.hue},80%,70%,0) 100%)`,
              animationDelay: `${m.delay}s`,
              animationDuration: `${m.duration}s`,
              boxShadow: `0 0 36px ${hexToRgba(glow, 0.85)}`,
              mixBlendMode: "screen",
            }}
          />
        ))}
        <style jsx global>{`
          .meteor {
            position: absolute;
            height: 3px;
            transform: rotate(20deg);
            filter: blur(0.3px);
            animation-name: nodify-meteor;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes nodify-meteor {
            0% { transform: translate3d(0,0,0) rotate(20deg); opacity: 0; }
            5% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translate3d(600px, 300px, 0) rotate(20deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (fx.kind === "shafts") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        {fx.shafts.map((s, i) => (
          <div
            key={`shaft-${i}`}
            className="nodify-shaft"
            style={{
              left: s.left,
              width: `${s.width}px`,
              opacity: s.opacity,
              transform: `rotate(${s.rot}deg)`,
              background: `linear-gradient(180deg, ${beam} 0%, transparent 70%)`,
              animationDuration: `${s.anim}s`,
            }}
          />
        ))}
        <style jsx global>{`
          .nodify-shaft {
            position: absolute;
            top: -20vh;
            bottom: -10vh;
            filter: blur(8px);
            animation-name: nodify-shaft-float;
            animation-direction: alternate;
            animation-iteration-count: infinite;
          }
          @keyframes nodify-shaft-float {
            from { transform-origin: center; transform: translateY(0) rotate(var(--r, 0)); }
            to { transform: translateY(8vh) rotate(var(--r, 0)); }
          }
        `}</style>
      </div>
    );
  }

  // Specks (morandi or default)
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
      {fx.specks.map((p, idx) => (
        <span
          key={`speck-${idx}`}
          className="nodify-speck"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: hexToRgba(dust, p.opacity),
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style jsx global>{`
        .nodify-speck {
          position: absolute;
          border-radius: 9999px;
          filter: blur(0.5px);
          animation-name: nodify-speck-rise;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes nodify-speck-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translateY(-30vh) translateX(8vw); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
