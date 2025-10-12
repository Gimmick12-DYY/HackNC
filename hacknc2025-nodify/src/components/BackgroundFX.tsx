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

    if (themeId === "ocean-surfing") {
      return { kind: "waves" as const };
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

  if (fx.kind === "waves") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <svg className="absolute bottom-0 left-0 w-full" style={{ height: "220px" }} preserveAspectRatio="none" viewBox="0 0 1440 320">
          <path
            className="wave-animation"
            fill="rgba(56, 189, 248, 0.4)"
            d="M0,160L48,149.3C96,139,192,117,288,122.7C384,128,480,160,576,165.3C672,171,768,149,864,133.3C960,117,1056,107,1152,112C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
          <path
            className="wave-animation-2"
            fill="rgba(14, 165, 233, 0.3)"
            d="M0,192L48,181.3C96,171,192,149,288,154.7C384,160,480,192,576,197.3C672,203,768,181,864,165.3C960,149,1056,139,1152,144C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
          <path
            className="wave-animation-3"
            fill="rgba(6, 182, 212, 0.2)"
            d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,229.3C672,235,768,213,864,197.3C960,181,1056,171,1152,176C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <style jsx global>{`
          @keyframes wave-flow {
            0% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
            100% { transform: translateY(0); }
          }
          @keyframes wave-flow-2 {
            0% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
            100% { transform: translateY(0); }
          }
          @keyframes wave-flow-3 {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
          }
          .wave-animation {
            animation: wave-flow 3s ease-in-out infinite;
            transform-origin: center;
          }
          .wave-animation-2 {
            animation: wave-flow-2 4s ease-in-out infinite;
            animation-delay: 0.5s;
            transform-origin: center;
          }
          .wave-animation-3 {
            animation: wave-flow-3 3.5s ease-in-out infinite;
            animation-delay: 1s;
            transform-origin: center;
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
