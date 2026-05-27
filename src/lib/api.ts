import type { ProviderId, TaskMode } from "@/types/chat";

type AiTaskRequest = {
  sessionId: string;
  prompt: string;
  provider: ProviderId;
  model: string;
  taskMode: TaskMode;
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

export async function runAiTask(request: AiTaskRequest): Promise<AnalyzeResponse> {
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
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(
        data?.error ?? "All providers are currently busy. Try again in a few minutes.",
      );
    }

    return response.json() as Promise<AnalyzeResponse>;
  }

  await new Promise((resolve) => setTimeout(resolve, 900));

  return {
    ok: true,
    provider: request.provider,
    model: request.model,
    content: buildLocalResponse(request.prompt, request.taskMode),
    usage: {
      requestsRemaining: 46,
      restoreTime: "in 18m 24s",
    },
  };
}

function buildLocalResponse(prompt: string, taskMode: TaskMode) {
  if (taskMode === "image") {
    return `> image task queued
 prompt parsed
 provider bridge ready

PROMPT
${prompt}

STATUS
The UI can route image intent now. Add a provider-specific image generation endpoint to return actual image assets.`;
  }

  if (taskMode === "video") {
    return `> video task queued
 prompt parsed
 provider bridge ready

PROMPT
${prompt}

STATUS
The UI can route video intent now. Add a provider-specific video generation endpoint to return actual video assets.`;
  }

  return `> response ready
 context parsed
 answer generated

PROMPT
${prompt}

NOTE
Connect the Cloudflare Worker and provider keys to replace this local preview with model output.`;
}
