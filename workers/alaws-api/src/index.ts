type AnalyzeRequest = {
  sessionId: string;
  prompt: string;
  model: string;
  instructions: string;
  history: AiMessage[];
  attachments: AiAttachment[];
};

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiAttachment = {
  kind: "image" | "video";
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

type Env = {
  NVIDIA_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  UPLOADS?: R2Bucket;
};

type R2Bucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
};

type R2ObjectBody = {
  body: ReadableStream<Uint8Array>;
  size: number;
  writeHttpMetadata(headers: Headers): void;
};

const NVIDIA_CHAT_COMPLETIONS_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";
const PROVIDER_TIMEOUT_MS = 45_000;
const VIDEO_PROVIDER_TIMEOUT_MS = 90_000;
const DEFAULT_PROMPT =
  "Analyze the attached media and answer naturally based on what you can see.";
const VIDEO_MODEL_IDS = new Set([
  "qwen/qwen3.5-397b-a17b",
  "qwen/qwen3.5-122b-a10b",
  "google/gemma-4-31b-it",
  "google/gemma-3n-e4b-it",
]);

const cleanErrors = {
  invalid: "Send a prompt or attach media before running the model.",
  invalidUpload: "Upload a PNG, JPG, WebP, MP4, WebM, or MOV file.",
  uploadTooLarge: "Images must be 10MB or smaller. Videos must be 50MB or smaller.",
  missingBucket: "Cloudflare R2 upload bucket is not configured.",
  missingKey: "NVIDIA API key is not configured.",
  unsupportedVideoModel:
    "Choose Qwen3.5, Gemma 4 31B, or Gemma 3n for video analysis.",
  unauthorized: "NVIDIA rejected the API key or account access.",
  unavailable: "The selected NVIDIA model is unavailable on this endpoint.",
  rateLimited: "The selected NVIDIA model is rate limited right now.",
  timeout: "The selected NVIDIA model took too long. Try a smaller model.",
  failed: "The selected NVIDIA model failed. Try again or choose another model.",
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/upload") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders);
      }

      try {
        return await handleUpload(request, env, corsHeaders);
      } catch {
        return json({ ok: false, error: "Media upload failed." }, 500, corsHeaders);
      }
    }

    if (url.pathname === "/api/media" || url.pathname.startsWith("/api/media/")) {
      try {
        return await handleMediaGet(request, env, corsHeaders);
      } catch {
        return json({ ok: false, error: "Media not available." }, 500, corsHeaders);
      }
    }

    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders);
      }

      try {
        const body = (await request.json()) as Partial<AnalyzeRequest>;
        const validated = validateAnalyzeRequest(body);
        return await streamNvidia(validated, env, request.signal, corsHeaders);
      } catch (error) {
        const normalized = normalizeError(error);
        return json(
          { ok: false, error: normalized.message },
          normalized.status,
          corsHeaders,
        );
      }
    }

    return json({ ok: false, error: "Not found" }, 404, corsHeaders);
  },
};

export default worker;

function validateAnalyzeRequest(body: Partial<AnalyzeRequest>): AnalyzeRequest {
  const attachments = normalizeAttachments(body.attachments);
  const prompt = body.prompt?.trim() ?? "";
  const model = body.model?.trim() || "google/gemma-3n-e4b-it";

  if (!prompt && attachments.length === 0) {
    throw new Error(cleanErrors.invalid);
  }

  if (hasVideoInput(prompt, attachments) && !VIDEO_MODEL_IDS.has(model)) {
    throw new Error(cleanErrors.unsupportedVideoModel);
  }

  return {
    sessionId: body.sessionId ?? "session_unknown",
    prompt,
    model,
    instructions:
      body.instructions?.trim() ||
      "You are Alaws lang, a natural AI assistant similar to ChatGPT.",
    history: normalizeHistory(body.history),
    attachments,
  };
}

function normalizeHistory(history: unknown): AiMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (message): message is AiMessage =>
        typeof message === "object" &&
        message !== null &&
        ((message as AiMessage).role === "user" ||
          (message as AiMessage).role === "assistant") &&
        typeof (message as AiMessage).content === "string" &&
        (message as AiMessage).content.trim().length > 0,
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function normalizeAttachments(attachments: unknown): AiAttachment[] {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .filter(
      (attachment): attachment is AiAttachment =>
        typeof attachment === "object" &&
        attachment !== null &&
        ((attachment as AiAttachment).kind === "image" ||
          (attachment as AiAttachment).kind === "video") &&
        typeof (attachment as AiAttachment).url === "string" &&
        /^https?:\/\//i.test((attachment as AiAttachment).url) &&
        typeof (attachment as AiAttachment).name === "string" &&
        typeof (attachment as AiAttachment).mimeType === "string" &&
        typeof (attachment as AiAttachment).size === "number",
    )
    .slice(0, 4)
    .map((attachment) => ({
      kind: attachment.kind,
      name: attachment.name.slice(0, 180),
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
    }));
}

async function streamNvidia(
  request: AnalyzeRequest,
  env: Env,
  requestSignal: AbortSignal,
  corsHeaders: HeadersInit,
) {
  if (!env.NVIDIA_API_KEY) {
    throw new Error(cleanErrors.missingKey);
  }

  const hasVideo = hasVideoInput(request.prompt, request.attachments);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    hasVideo ? VIDEO_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS,
  );
  const signal = combineAbortSignals(requestSignal, timeoutController.signal);
  const body = buildNvidiaBody(request, hasVideo);
  const response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    clearTimeout(timeoutId);
    throw new ProviderError(response.status);
  }

  if (!response.body) {
    clearTimeout(timeoutId);
    throw new Error("NVIDIA stream body missing");
  }

  const stream = createTextStream(response.body, timeoutId);

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function buildNvidiaBody(request: AnalyzeRequest, hasVideo: boolean) {
  return {
    model: request.model,
    messages: [
      {
        role: "system",
        content: request.instructions,
      },
      ...request.history,
      buildUserMessage(request),
    ],
    temperature: 0.2,
    max_tokens: hasVideo ? 1600 : 1200,
    stream: true,
    ...(hasVideo
      ? {
          media_io_kwargs: {
            video: {
              fps: 1.0,
            },
          },
          mm_processor_kwargs: {
            size: {
              shortest_edge: 1568,
              longest_edge: 262144,
            },
          },
        }
      : {}),
  };
}

function buildUserMessage(request: AnalyzeRequest) {
  const media = [...request.attachments, ...extractMediaUrls(request.prompt)].slice(0, 4);

  if (!media.length) {
    return {
      role: "user",
      content: request.prompt,
    };
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: request.prompt || DEFAULT_PROMPT,
      },
      ...media.map((attachment) =>
        attachment.kind === "image"
          ? {
              type: "image_url",
              image_url: { url: attachment.url },
            }
          : {
              type: "video_url",
              video_url: { url: attachment.url },
            },
      ),
    ],
  };
}

function extractMediaUrls(prompt: string): AiAttachment[] {
  const matches = prompt.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];

  return matches
    .map((rawUrl) => rawUrl.replace(/[),.]+$/, ""))
    .map((url): AiAttachment | null => {
      let pathname = "";

      try {
        pathname = new URL(url).pathname.toLowerCase();
      } catch {
        return null;
      }

      const image = /\.(png|jpe?g|webp)$/i.test(pathname);
      const video = /\.(mp4|webm|mov)$/i.test(pathname);

      if (!image && !video) {
        return null;
      }

      return {
        kind: image ? "image" : "video",
        name: pathname.split("/").pop() || url,
        mimeType: image ? "image/*" : "video/*",
        size: 0,
        url,
      };
    })
    .filter((attachment): attachment is AiAttachment => Boolean(attachment));
}

function hasVideoInput(prompt: string, attachments: AiAttachment[]) {
  return (
    attachments.some((attachment) => attachment.kind === "video") ||
    extractMediaUrls(prompt).some((attachment) => attachment.kind === "video")
  );
}

async function handleUpload(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit,
) {
  if (!env.UPLOADS) {
    return json({ ok: false, error: cleanErrors.missingBucket }, 500, corsHeaders);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !isAllowedMedia(file.type)) {
    return json({ ok: false, error: cleanErrors.invalidUpload }, 400, corsHeaders);
  }

  const kind = file.type.startsWith("video/") ? "video" : "image";
  const maxSize = kind === "image" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

  if (file.size > maxSize) {
    return json({ ok: false, error: cleanErrors.uploadTooLarge }, 413, corsHeaders);
  }

  const key = `uploads/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      kind,
    },
  });

  const mediaUrl = new URL(request.url);
  mediaUrl.pathname = `/api/media/${key}`;
  mediaUrl.search = "";

  return json(
    {
      ok: true,
      attachment: {
        kind,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        url: mediaUrl.toString(),
      },
    },
    200,
    corsHeaders,
  );
}

async function handleMediaGet(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit,
) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders);
  }

  if (!env.UPLOADS) {
    return json({ ok: false, error: cleanErrors.missingBucket }, 500, corsHeaders);
  }

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/media\/?/, ""));

  if (!key.startsWith("uploads/")) {
    return json({ ok: false, error: "Not found" }, 404, corsHeaders);
  }

  const object = await env.UPLOADS.get(key);

  if (!object) {
    return json({ ok: false, error: "Not found" }, 404, corsHeaders);
  }

  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Content-Length", String(object.size));

  return new Response(object.body, { headers });
}

function isAllowedMedia(mimeType: string) {
  return [
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ].includes(mimeType);
}

function safeFileName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "media"
  );
}

function createTextStream(
  providerBody: ReadableStream<Uint8Array>,
  timeoutId: ReturnType<typeof setTimeout>,
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = providerBody.getReader();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          clearTimeout(timeoutId);
          const remaining = flushSseBuffer(buffer);

          if (remaining) {
            controller.enqueue(encoder.encode(remaining));
          }

          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const splitIndex = buffer.lastIndexOf("\n\n");

        if (splitIndex === -1) {
          continue;
        }

        const chunk = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        const text = parseSseText(chunk);

        if (text) {
          controller.enqueue(encoder.encode(text));
          return;
        }
      }
    },
    cancel() {
      clearTimeout(timeoutId);
      reader.cancel();
    },
  });
}

function flushSseBuffer(buffer: string) {
  return parseSseText(buffer);
}

function parseSseText(chunk: string) {
  let text = "";

  for (const event of chunk.split("\n\n")) {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();

      if (!data || data === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: unknown; reasoning_content?: unknown };
            message?: { content?: unknown; reasoning_content?: unknown };
            text?: unknown;
          }>;
        };
        const choice = parsed.choices?.[0];
        text +=
          extractText(choice?.delta?.content) ||
          extractText(choice?.message?.content) ||
          extractText(choice?.text) ||
          "";
      } catch {
        // Ignore malformed provider chunks and continue streaming valid chunks.
      }
    }
  }

  return text;
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("");
}

function normalizeError(error: unknown) {
  if (error instanceof Error && error.message === cleanErrors.invalid) {
    return { status: 400, message: cleanErrors.invalid };
  }

  if (error instanceof Error && error.message === cleanErrors.missingKey) {
    return { status: 500, message: cleanErrors.missingKey };
  }

  if (error instanceof Error && error.message === cleanErrors.unsupportedVideoModel) {
    return { status: 400, message: cleanErrors.unsupportedVideoModel };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return { status: 504, message: cleanErrors.timeout };
  }

  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) {
      return { status: 502, message: cleanErrors.unauthorized };
    }

    if (error.status === 404) {
      return { status: 404, message: cleanErrors.unavailable };
    }

    if (error.status === 429) {
      return { status: 429, message: cleanErrors.rateLimited };
    }
  }

  return { status: 502, message: cleanErrors.failed };
}

class ProviderError extends Error {
  constructor(readonly status: number) {
    super(`NVIDIA provider error ${status}`);
  }
}

function combineAbortSignals(...signals: AbortSignal[]) {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller.signal;
}

function buildCorsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN || "http://localhost:3000";
  const responseOrigin = origin === allowedOrigin ? origin : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}
