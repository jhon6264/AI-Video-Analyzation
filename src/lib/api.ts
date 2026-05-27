import type { ProviderId } from "@/types/chat";

type AnalyzeRequest = {
  sessionId: string;
  prompt: string;
  provider: ProviderId;
  model: string;
  instructions: string;
  fallback: boolean;
};

export type AnalyzeResponse = {
  ok: boolean;
  provider: ProviderId;
  model: string;
  content: string;
  usage: {
    requestsRemaining: number;
    restoreTime: string;
  };
};

export async function analyzeVideo(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const workerUrl = process.env.NEXT_PUBLIC_ALAWS_WORKER_URL;

  if (workerUrl) {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("All providers are currently busy. Try again in a few minutes.");
    }

    return response.json() as Promise<AnalyzeResponse>;
  }

  await new Promise((resolve) => setTimeout(resolve, 900));

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    content: buildLocalAnalysis(request.prompt),
    usage: {
      requestsRemaining: 46,
      restoreTime: "in 18m 24s",
    },
  };
}

function buildLocalAnalysis(prompt: string) {
  const url = prompt.match(/https?:\/\/\S+/)?.[0] ?? "provided video URL";

  return `> analyzing video...
 audio transcription ✓
 scene detection ✓
 key moment extraction ✓
 summarization complete ✓

SOURCE
${url}

SUMMARY
The video appears ready for structured review. Connect the Cloudflare Worker to replace this local preview with provider output.

KEY MOMENTS
[00:00] Video begins
[01:20] Primary activity enters frame
[03:12] Warning candidate: restricted or notable event
[06:40] Important change in scene state
[08:02] Activity returns to normal

WARNINGS
orange: verify public access to the video URL
red: provider keys must stay inside Cloudflare Worker environment variables

ACTION ITEMS
- Connect POST /api/analyze in the Cloudflare Worker
- Test with a public or signed video URL
- Review timestamps against the provider response`;
}
