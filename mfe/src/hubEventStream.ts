export interface PantheonStreamEvent {
  event?: string;
  timestamp?: number;
  payload?: Record<string, unknown>;
}

export async function subscribeHubEventStream(
  hubBase: string,
  headers: Record<string, string>,
  onEvent: (event: PantheonStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${hubBase}/api/v1/events/stream`, { headers, signal });
  if (!response.ok || !response.body) {
    throw new Error(`Event stream failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd = buffer.indexOf("\n\n");
    while (frameEnd >= 0) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (dataLine) {
        try {
          onEvent(JSON.parse(dataLine) as PantheonStreamEvent);
        } catch {
          // ignore malformed frames
        }
      }
      frameEnd = buffer.indexOf("\n\n");
    }
  }
}
