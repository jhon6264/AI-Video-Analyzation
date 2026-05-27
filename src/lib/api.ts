type AiTaskRequest = {
  sessionId: string;
  prompt: string;
  model: string;
  instructions: string;
  history: AiMessage[];
  attachments?: AiAttachment[];
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

export type AiAttachment = {
  kind: "image" | "video";
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

export type UploadResponse = {
  ok: boolean;
  attachment: AiAttachment;
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

    const content = await readTextStream(response, onToken, signal);

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

export async function uploadMedia(file: File): Promise<AiAttachment> {
  const workerUrl = process.env.NEXT_PUBLIC_ALAWS_WORKER_URL;

  if (!workerUrl) {
    throw new Error("Connect the Cloudflare Worker before uploading media.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${workerUrl.replace(/\/$/, "")}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as
    | { error?: string; attachment?: AiAttachment }
    | null;

  if (!response.ok || !data?.attachment) {
    throw new Error(data?.error ?? "Media upload failed.");
  }

  return data.attachment;
}

async function readTextStream(
  response: Response,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
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
    await emitTypewriterToken(token, onToken, signal);
  }

  const trailing = decoder.decode();

  if (trailing) {
    content += trailing;
    await emitTypewriterToken(trailing, onToken, signal);
  }

  return content;
}

async function emitTypewriterToken(
  token: string,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
) {
  if (!onToken || !token) {
    return;
  }

  const chunks = chunkText(token, 4);

  for (const chunk of chunks) {
    if (signal?.aborted) {
      throw new DOMException("Request aborted", "AbortError");
    }

    onToken(chunk);

    if (chunks.length > 1) {
      await wait(8, signal);
    }
  }
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }

  return chunks.length ? chunks : [text];
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
