"use client";

import * as React from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";

// Emotion SSR registry for Next.js App Router to avoid hydration mismatches
export default function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [cache] = React.useState(() => {
    // Use an insertion point if present to ensure styles go to <head>
    let insertionPoint: HTMLElement | undefined;
    if (typeof document !== "undefined") {
      const el = document.querySelector<HTMLMetaElement>('meta[name="emotion-insertion-point"]');
      insertionPoint = (el as unknown as HTMLElement) ?? undefined;
    }
    const cache = createCache({ key: "mui", insertionPoint, prepend: true });
    // compat mode for Emotion + MUI v7
    (cache as any).compat = true;
    return cache;
  });

  useServerInsertedHTML(() => {
    // Collect and inject Emotion styles on the server to match client render
    const names = Object.keys(cache.inserted);
    if (names.length === 0) return null;
    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: names.map((name) => (cache.inserted as any)[name]).join(" "),
        }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
