import type { ProviderId } from "@/types/chat";

type AiTaskRequest = {
  sessionId: string;
  prompt: string;
  provider: ProviderId;
  model: string;
  instructions: string;
  signal?: AbortSignal;
};

export type AnalyzeResponse = {
  ok: boolean;
  provider: ProviderId;
  model: string;
  content: string;
  usage: {
    requestsRemaining: number;
    restoreTime: string;
    rateLimitSource?: "provider-header" | "estimated" | "unknown";
  };
};

export async function runAiTask({
  signal,
  ...request
}: AiTaskRequest): Promise<AnalyzeResponse> {
  const workerUrl = process.env.NEXT_PUBLIC_ALAWS_WORKER_URL;

  if (workerUrl) {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(
        data?.error ?? "All providers are currently busy. Try again in a few minutes.",
      );
    }

    return response.json() as Promise<AnalyzeResponse>;
  }

  await wait(900, signal);

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    content: `> response ready
 context parsed
 answer generated

PROMPT
${request.prompt}

NOTE
Connect the Cloudflare Worker and provider keys to replace this local preview with model output.`,
    usage: {
      requestsRemaining: 46,
      restoreTime: "in 18m 24s",
      rateLimitSource: "estimated",
    },
  };
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timeout = window.setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Request aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
