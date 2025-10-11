import { NextRequest, NextResponse } from "next/server";
import {
  DebateArgument,
  DebateRecord,
  DebateRequestNode,
  DebateSide,
} from "@/components/types";

type DebatePayload = {
  topic: string;
  summary: string;
  keyInsights: string[];
  verdict: string;
  recommendations: string[];
  sources: string[];
  sides: Array<{
    label: string;
    stance: string;
    summary: string;
    arguments: Array<{
      title: string;
      statement: string;
      evidence: string;
      support: string;
      weight: string;
    }>;
    rebuttals: string[];
  }>;
};

const systemPrompt = `You are a debate strategist who produces structured, insight-heavy briefings for product teams.
You will be given multiple mind-map notes that represent viewpoints on the same theme.
Your job is to synthesize a debate-ready briefing as STRICT JSON with this exact shape:
{
  "topic": string,
  "summary": string,
  "keyInsights": string[3],
  "verdict": string,
  "recommendations": string[2-4],
  "sources": string[],
  "sides": [
    {
      "label": string,
      "stance": string,
      "summary": string,
      "arguments": [
        {
          "title": string,
          "statement": string,
          "evidence": string,
          "support": string,
          "weight": "strong" | "medium" | "weak"
        },
        ...
      ],
      "rebuttals": string[0-3]
    },
    ...
  ]
}
Rules:
- ALWAYS output valid JSON matching the schema above. No markdown code fences.
- Arguments must have distinct titles and cite specific evidence drawn or inferred from the notes.
- keyInsights must be sharp, non-overlapping takeaways.
- Include 2-3 sides when possible, each with 2-3 arguments.
- sources may be empty if nothing explicit is provided.
- Never include commentary outside of the JSON object.`;

const cleanString = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new Error("Expected string value in debate response");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Received empty string in debate response");
  }
  return trimmed;
};

const cleanStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array for ${label}`);
  }
  return value.map((entry) => cleanString(entry));
};

const normalizeArgument = (raw: unknown): DebateArgument => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Argument entry must be an object");
  }
  const source = raw as Record<string, unknown>;
  const weight = cleanString(source.weight).toLowerCase();
  if (!["strong", "medium", "weak"].includes(weight)) {
    throw new Error("Invalid weight value in arguments");
  }
  return {
    title: cleanString(source.title),
    statement: cleanString(source.statement),
    evidence: cleanString(source.evidence),
    support: cleanString(source.support),
    weight: weight as "strong" | "medium" | "weak",
  };
};

const normalizeSide = (raw: unknown): DebateSide => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Side entry must be an object");
  }
  const source = raw as Record<string, unknown>;
  if (
    !Array.isArray(source.arguments) ||
    source.arguments.length === 0
  ) {
    throw new Error("Each side must include at least one argument");
  }
  return {
    label: cleanString(source.label),
    stance: cleanString(source.stance),
    summary: cleanString(source.summary),
    arguments: source.arguments.map((entry) => normalizeArgument(entry)),
    rebuttals: Array.isArray(source.rebuttals)
      ? source.rebuttals.map((item: unknown) => cleanString(item))
      : [],
  };
};

const extractJsonObject = (content: string): unknown => {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  const inner = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const objMatch = inner.match(/\{[\s\S]*\}/);
  const candidate = objMatch ? objMatch[0] : inner;
  return JSON.parse(candidate);
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { nodes?: DebateRequestNode[] };
    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    if (nodes.length < 2) {
      return NextResponse.json(
        { error: "At least two nodes are required to run a debate." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const formattedNodes = nodes
      .map(
        (node, index) =>
          `${index + 1}. (${node.type}) ` +
          `${node.phrase ?? node.short ?? node.full.slice(0, 40)}\n` +
          `   Full: ${node.full}`
      )
      .join("\n");

    const userPrompt = `Build a structured debate briefing using these notes:\n\n${formattedNodes}\n
Focus on the tensions and alignments that emerge between the notes.
Infer reasonable evidence when necessary, but stay grounded to the provided material.`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Missing content from debate model response" },
        { status: 502 }
      );
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = extractJsonObject(content);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to parse debate response as JSON",
          details: error instanceof Error ? error.message : String(error),
          raw: content,
        },
        { status: 422 }
      );
    }

    if (!parsedRaw || typeof parsedRaw !== "object") {
      return NextResponse.json(
        { error: "Debate response is not a JSON object" },
        { status: 422 }
      );
    }

    const parsed = parsedRaw as Record<string, unknown>;
    if (!Array.isArray(parsed.sides)) {
      return NextResponse.json(
        { error: "Debate response missing sides array" },
        { status: 422 }
      );
    }

    const payload: DebatePayload = {
      topic: cleanString(parsed.topic),
      summary: cleanString(parsed.summary),
      keyInsights: cleanStringArray(parsed.keyInsights, "keyInsights"),
      verdict: cleanString(parsed.verdict),
      recommendations: cleanStringArray(
        parsed.recommendations,
        "recommendations"
      ),
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.map((value: unknown) => cleanString(value))
        : [],
      sides: parsed.sides.map((side: unknown) => normalizeSide(side)),
    };

    if (!payload.sides.length) {
      throw new Error("Debate response must include at least one side");
    }

    const debate: DebateRecord = {
      id: `debate-${Date.now()}`,
      createdAt: Date.now(),
      topic: payload.topic,
      summary: payload.summary,
      keyInsights: payload.keyInsights,
      verdict: payload.verdict,
      recommendations: payload.recommendations,
      sources: payload.sources,
      promptNodes: nodes,
      sides: payload.sides.map(
        (side): DebateSide => ({
          label: side.label,
          stance: side.stance,
          summary: side.summary,
          arguments: side.arguments.map(
            (argument): DebateArgument => ({
              title: argument.title,
              statement: argument.statement,
              evidence: argument.evidence,
              support: argument.support,
              weight: argument.weight as "strong" | "medium" | "weak",
            })
          ),
          rebuttals: side.rebuttals,
        })
      ),
    };

    return NextResponse.json({ debate });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown debate error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
