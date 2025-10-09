import { NextRequest, NextResponse } from "next/server";

type GeneratedNodeContent = {
  full: string;
  phrase?: string;
  short?: string;
  emoji?: string;
  type?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, count, phraseLength, temperature } = await req.json();
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const sys = `You are a concise brainstorming assistant.
Return valid JSON only: an array with exactly ${count} objects.
Each object must include:
- "full": one sentence elaborating the idea (≈ ${phraseLength * 8} characters),
- "phrase": a 2-3 word fragment,
- "short": a single word or emoji,
- "emoji": one emoji character,
- "type": one of "idea", "argument", "counter", "reference", "analogy".
Do not add commentary before or after the JSON.`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    
    if (process.env.OPENROUTER_REFERRER) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_REFERRER;
    }
    
    if (process.env.OPENROUTER_TITLE) {
      headers["X-Title"] = process.env.OPENROUTER_TITLE;
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        temperature: typeof temperature === "number" ? temperature : 0.7,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `OpenRouter error ${res.status}`, details: txt },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "[]";
    // Robust extraction: try to parse fenced code, then first bracketed array, then fallback
    const extractItems = (txt: string): GeneratedNodeContent[] => {
      const clean = txt.trim();
      const fence = clean.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
      const inner = fence ? fence[1].trim() : clean;
      const arrMatch = inner.match(/\[[\s\S]*?\]/);
      const candidate = arrMatch ? arrMatch[0] : inner;
      const hydrate = (input: unknown): GeneratedNodeContent[] => {
        if (!Array.isArray(input)) return [];
        return input
          .map((entry): GeneratedNodeContent | null => {
            if (entry && typeof entry === "object") {
              const obj = entry as Record<string, unknown>;
              const full = (obj.full ?? obj.text ?? obj.description ?? obj.phrase) as
                | string
                | undefined;
              if (!full) return null;
              const phrase = obj.phrase as string | undefined;
              const short = obj.short as string | undefined;
              const emoji = obj.emoji as string | undefined;
              const type = obj.type as string | undefined;
              const sanitize = (value?: string) =>
                value ? String(value).trim() : undefined;
              const sanitizedFull = String(full).trim();
              if (!sanitizedFull) return null;
              return {
                full: sanitizedFull,
                phrase: sanitize(phrase),
                short: sanitize(short),
                emoji: sanitize(emoji),
                type: sanitize(type),
              };
            }
            if (typeof entry === "string") {
              const value = entry.trim();
              if (!value) return null;
              const firstWord = value.split(/\s+/)[0] || value;
              return {
                full: value,
                phrase: value,
                short: firstWord,
                emoji: "",
                type: "idea",
              };
            }
            return null;
          })
          .filter((item): item is GeneratedNodeContent => Boolean(item));
      };

      const tryParse = (s: string): GeneratedNodeContent[] => {
        try {
          const parsed = JSON.parse(s);
          return hydrate(parsed);
        } catch {
          return [];
        }
      };

      let arr = tryParse(candidate);
      if (!arr.length) {
        const swapped = candidate.replace(/'(.*?)'/g, '"$1"');
        arr = tryParse(swapped);
      }
      if (!arr.length) {
        arr = inner
          .split(/\r?\n|\u2022|^-\s+/gm)
          .map((s) => s.replace(/^[-*\d+.\)\s]+/, "").trim())
          .filter(Boolean)
          .map((value) => {
            const word = value.split(/\s+/)[0] || value;
            return {
              full: value,
              phrase: value,
              short: word,
              emoji: "",
              type: "idea",
            };
          });
      }
      const limit = typeof count === "number" ? count : Number(count) || 5;
      return arr.slice(0, limit).map((item) => ({
        full: item.full,
        phrase: item.phrase ?? item.full,
        short: item.short ?? item.full.split(/\s+/)[0] ?? item.full,
        emoji: item.emoji ?? "",
        type: item.type ?? "idea",
      }));
    };

    const items = extractItems(content);

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
