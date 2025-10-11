import { DebateRecord, DebateRequestNode } from "./types";

type DebateApiResponse = {
  debate: DebateRecord;
};

type DebateOptions = {
  signal?: AbortSignal;
};

const isDebateRecord = (value: unknown): value is DebateRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as DebateRecord;
  return (
    typeof record.id === "string" &&
    typeof record.topic === "string" &&
    Array.isArray(record.sides)
  );
};

export async function debateNodes(
  nodes: DebateRequestNode[],
  options?: DebateOptions
): Promise<DebateRecord> {
  if (!Array.isArray(nodes) || nodes.length < 2) {
    throw new Error("Select at least two notes before running a debate.");
  }
  const res = await fetch("/api/debate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nodes }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const message = await res
      .text()
      .catch(() => "Unknown debate service error");
    throw new Error(
      `Debate request failed (${res.status}): ${message.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as DebateApiResponse;
  if (!isDebateRecord(data?.debate)) {
    throw new Error("Received malformed debate response from the server.");
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[debate] generated result:", data.debate);
  }
  return data.debate;
}
