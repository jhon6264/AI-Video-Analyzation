type AiTaskRequest = {
  sessionId: string;
  prompt: string;
  model: string;
  instructions: string;
  history: AiMessage[];
  signal?: AbortSignal;
  onToken?: (token: string) => void;
};

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AnalyzeResponse = {
  ok: boolean;
  provider: "nvidia";
  model: string;
  content: string;
};

export async function runAiTask({
  onToken,
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
        data?.error ?? "The selected NVIDIA model failed. Try another model.",
      );
    }

    const content = await readTextStream(response, onToken);

    return {
      ok: true,
      provider: "nvidia",
      model: request.model,
      content,
    };
  }

  await wait(900, signal);

  const content = `> response ready
 context parsed
 answer generated

PROMPT
${request.prompt}

NOTE
Connect the Cloudflare Worker and provider keys to replace this local preview with model output.`;

  onToken?.(content);

  return {
    ok: true,
    provider: "nvidia",
    model: request.model,
    content,
  };
}

async function readTextStream(
  response: Response,
  onToken?: (token: string) => void,
) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const token = decoder.decode(value, { stream: true });
    content += token;
    onToken?.(token);
  }

  const trailing = decoder.decode();

  if (trailing) {
    content += trailing;
    onToken?.(trailing);
  }

  return content;
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
