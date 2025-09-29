import { NextRequest, NextResponse } from "next/server";

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

    const sys = `You are a concise brainstorming assistant. Generate only a JSON array of ${count} short, evocative phrases (~${phraseLength} chars each), no extra text.`;

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
        model: process.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo",
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
    const extractItems = (txt: string): string[] => {
      const clean = txt.trim();
      // Extract inner code fence if present
      const fence = clean.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
      const inner = fence ? fence[1].trim() : clean;
      // Find first JSON array in text
      const arrMatch = inner.match(/\[[\s\S]*?\]/);
      const candidate = arrMatch ? arrMatch[0] : inner;
      const tryParse = (s: string): string[] | null => {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map((v) => String(v));
          return null;
        } catch {
          return null;
        }
      };
      let arr = tryParse(candidate);
      if (!arr) {
        // Try with single quotes swapped
        const swapped = candidate.replace(/'(.*?)'/g, '"$1"');
        arr = tryParse(swapped);
      }
      if (!arr) {
        // Fallback: split by lines/bullets/numbers
        arr = inner
          .split(/\r?\n|\u2022|^-\s+/gm)
          .map((s) => s.replace(/^[-*\d+.\)\s]+/, "").trim())
          .filter(Boolean);
      }
      const n = typeof count === "number" ? count : Number(count) || 5;
      return arr.slice(0, n);
    };

    const items = extractItems(content);

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
