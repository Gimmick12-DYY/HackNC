"use client";

import * as React from "react";
import { CacheProvider } from "@emotion/react";
import createCache, { type EmotionCache } from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";

// Emotion SSR registry for Next.js App Router to avoid hydration mismatches
export default function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = React.useState<EmotionCache>(() => {
    // Use an insertion point if present to ensure styles go to <head>
    let insertionPoint: HTMLElement | undefined;
    if (typeof document !== "undefined") {
      const el = document.querySelector<HTMLMetaElement>('meta[name="emotion-insertion-point"]');
      insertionPoint = el ?? undefined;
    }
    const emotionCache = createCache({ key: "mui", insertionPoint, prepend: true });
    // compat mode for Emotion + MUI v7
    emotionCache.compat = true;
    return emotionCache;
  });

  useServerInsertedHTML(() => {
    // Collect and inject Emotion styles on the server to match client render
    const names = Object.keys(cache.inserted);
    if (names.length === 0) return null;
    const styles = names
      .map((name) => cache.inserted[name])
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: styles,
        }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
