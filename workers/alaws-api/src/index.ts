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
const NVIDIA_STATUS_URL = "https://integrate.api.nvidia.com/v1/status";
const PROVIDER_TIMEOUT_MS = 45_000;
const VIDEO_PROVIDER_TIMEOUT_MS = 90_000;
const STREAM_INACTIVITY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 360_000;
const DEFAULT_PROMPT =
  "Analyze the attached media and answer naturally based on what you can see.";
const VIDEO_MODEL_IDS = new Set([
  "qwen/qwen3.5-397b-a17b",
  "qwen/qwen3.5-122b-a10b",
  "google/gemma-4-31b-it",
  "google/gemma-3n-e4b-it",
]);
type ModelProfile = {
  extraBody?: Record<string, unknown>;
  maxTokens?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  responseMode?: "stream" | "poll";
  temperature?: number;
  topP?: number;
  topK?: number;
  startupTimeoutMs?: number;
  streamInactivityTimeoutMs?: number;
  historyLimit?: number;
  mediaHistoryLimit?: number;
  systemMode?: "system" | "prepend-to-user";
  stripOutput?: "gemma-channel-tags";
  videoFps?: number;
};

const MODEL_PROFILES: Record<string, ModelProfile> = {
  "deepseek-ai/deepseek-v4-pro": {
    extraBody: {
      reasoning_effort: "high",
    },
    maxTokens: 4096,
    responseMode: "poll",
    startupTimeoutMs: 240_000,
    streamInactivityTimeoutMs: 90_000,
    historyLimit: 4,
  },
  "google/gemma-4-31b-it": {
    extraBody: {
      chat_template_kwargs: {
        enable_thinking: true,
      },
    },
    maxTokens: 4096,
    responseMode: "poll",
    temperature: 1,
    topP: 0.95,
    topK: 64,
    startupTimeoutMs: 150_000,
    streamInactivityTimeoutMs: 60_000,
    historyLimit: 4,
    mediaHistoryLimit: 2,
    systemMode: "prepend-to-user",
    stripOutput: "gemma-channel-tags",
    videoFps: 0.5,
  },
  "moonshotai/kimi-k2.6": {
    extraBody: {
      chat_template_kwargs: {
        thinking: true,
      },
    },
    maxTokens: 4096,
    responseMode: "poll",
    startupTimeoutMs: 240_000,
    streamInactivityTimeoutMs: 90_000,
    historyLimit: 4,
  },
};

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
  timeout:
    "The selected large model is still processing or queued. Try a shorter prompt or choose a faster model.",
  pendingWithoutId:
    "NVIDIA accepted the selected model request but did not return a polling request ID.",
  incompatible:
    "The selected model request is incompatible with NVIDIA's endpoint. Try a shorter prompt or choose a faster model.",
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
  const profile = getModelProfile(request.model);
  const providerController = new AbortController();
  const abortProvider = () => providerController.abort();
  const startupTimeoutId = setTimeout(
    abortProvider,
    profile.startupTimeoutMs ??
      (hasVideo ? VIDEO_PROVIDER_TIMEOUT_MS : PROVIDER_TIMEOUT_MS),
  );
  const removeRequestAbortListener = () => {
    requestSignal.removeEventListener("abort", abortProvider);
  };

  if (requestSignal.aborted) {
    abortProvider();
  } else {
    requestSignal.addEventListener("abort", abortProvider, { once: true });
  }

  const signal = providerController.signal;
  const body = buildNvidiaBody(request, hasVideo, profile);
  const usesPolling = profile.responseMode === "poll";
  let streamOwnsAbortCleanup = false;
  let response: Response;

  try {
    response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Accept: usesPolling ? "application/json" : "text/event-stream",
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    clearTimeout(startupTimeoutId);

    if (!response.ok) {
      throw new ProviderError(response.status, await readProviderError(response));
    }

    if (usesPolling) {
      const content = await readPolledNvidiaText(response, env, signal, profile);

      return new Response(content, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (response.status === 202) {
      throw new Error(cleanErrors.timeout);
    }

    if (!response.body) {
      throw new Error("NVIDIA stream body missing");
    }

    const stream = createTextStream(response.body, {
      abortController: providerController,
      inactivityTimeoutMs:
        profile.streamInactivityTimeoutMs ?? STREAM_INACTIVITY_TIMEOUT_MS,
      onCleanup: removeRequestAbortListener,
      requestSignal,
      stripOutput: profile.stripOutput,
    });
    streamOwnsAbortCleanup = true;

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } finally {
    clearTimeout(startupTimeoutId);

    if (!streamOwnsAbortCleanup) {
      removeRequestAbortListener();
    }
  }
}

function buildNvidiaBody(
  request: AnalyzeRequest,
  hasVideo: boolean,
  profile: ReturnType<typeof getModelProfile>,
) {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: buildNvidiaMessages(request, profile),
    temperature: profile.temperature ?? 0.2,
    max_tokens: profile.maxTokens ?? (hasVideo ? 1200 : 1000),
    stream: profile.responseMode !== "poll",
  };

  if (typeof profile.topP === "number") {
    body.top_p = profile.topP;
  }

  if (typeof profile.topK === "number") {
    body.top_k = profile.topK;
  }

  if (profile.extraBody) {
    Object.assign(body, profile.extraBody);
  }

  if (hasVideo) {
    body.media_io_kwargs = {
      video: {
        fps: profile.videoFps ?? 0.75,
      },
    };
    body.mm_processor_kwargs = {
      size: {
        shortest_edge: 1568,
        longest_edge: 262144,
      },
    };
  }

  return body;
}

function buildNvidiaMessages(request: AnalyzeRequest, profile: ModelProfile) {
  const history = getProfiledHistory(request.history, profile, hasMediaInput(request));
  const userMessage = buildUserMessage(
    request,
    profile.systemMode === "prepend-to-user" ? request.instructions : undefined,
  );

  if (profile.systemMode === "prepend-to-user") {
    return [...history, userMessage];
  }

  return [
    {
      role: "system",
      content: request.instructions,
    },
    ...history,
    userMessage,
  ];
}

function getProfiledHistory(
  history: AiMessage[],
  profile: ModelProfile,
  hasMedia: boolean,
) {
  const limit = hasMedia
    ? profile.mediaHistoryLimit ?? profile.historyLimit
    : profile.historyLimit;

  return typeof limit === "number" ? history.slice(-limit) : history;
}

function buildUserMessage(request: AnalyzeRequest, instructionPrefix?: string) {
  const media = [...request.attachments, ...extractMediaUrls(request.prompt)].slice(0, 4);
  const text = buildPromptText(request.prompt || DEFAULT_PROMPT, instructionPrefix);

  if (!media.length) {
    return {
      role: "user",
      content: text,
    };
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text,
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

function buildPromptText(text: string, instructionPrefix?: string) {
  if (!instructionPrefix) {
    return text;
  }

  return `${instructionPrefix}\n\nUser request:\n${text}`;
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

function hasMediaInput(request: AnalyzeRequest) {
  return request.attachments.length > 0 || extractMediaUrls(request.prompt).length > 0;
}

function getModelProfile(model: string) {
  return MODEL_PROFILES[model] ?? {};
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

async function readPolledNvidiaText(
  response: Response,
  env: Env,
  signal: AbortSignal,
  profile: ModelProfile,
) {
  throwIfAborted(signal);

  if (response.status === 200) {
    return cleanModelOutput(extractNvidiaText(await readResponseJson(response)), profile);
  }

  if (response.status !== 202) {
    throw new ProviderError(response.status, await readProviderError(response));
  }

  const requestId = extractRequestId(await readResponseJson(response));

  if (!requestId) {
    throw new ProviderError(response.status, cleanErrors.pendingWithoutId);
  }

  const timeoutMs = profile.pollTimeoutMs ?? POLL_TIMEOUT_MS;
  const intervalMs = profile.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await waitForPoll(intervalMs, signal);
    throwIfAborted(signal);

    const pollResponse = await fetch(
      `${NVIDIA_STATUS_URL}/${encodeURIComponent(requestId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        },
        signal,
      },
    );
    throwIfAborted(signal);

    if (pollResponse.status === 202) {
      continue;
    }

    if (!pollResponse.ok) {
      throw new ProviderError(
        pollResponse.status,
        await readProviderError(pollResponse),
      );
    }

    return cleanModelOutput(
      extractNvidiaText(await readResponseJson(pollResponse)),
      profile,
    );
  }

  throw new Error(cleanErrors.timeout);
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }
}

async function readResponseJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function extractRequestId(value: unknown): string {
  const record = toRecord(value);

  if (!record) {
    return "";
  }

  for (const key of ["requestId", "request_id"]) {
    const id = record[key];

    if (typeof id === "string" && id.length > 0 && id.length <= 80) {
      return id;
    }
  }

  for (const key of ["response", "result", "data"]) {
    const id = extractRequestId(record[key]);

    if (id) {
      return id;
    }
  }

  return "";
}

function extractNvidiaText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractNvidiaText(item, depth + 1)).join("");
  }

  const record = toRecord(value);

  if (!record) {
    return "";
  }

  const choices = record.choices;

  if (Array.isArray(choices)) {
    const text = choices
      .map((choice) => extractNvidiaText(choice, depth + 1))
      .join("");

    if (text) {
      return text;
    }
  }

  for (const key of ["message", "delta"]) {
    const text = extractNvidiaText(record[key], depth + 1);

    if (text) {
      return text;
    }
  }

  for (const key of ["content", "text", "output_text"]) {
    const text = extractText(record[key]);

    if (text) {
      return text;
    }
  }

  for (const key of ["output", "response", "result", "data"]) {
    const text = extractNvidiaText(record[key], depth + 1);

    if (text) {
      return text;
    }
  }

  return "";
}

function cleanModelOutput(text: string, profile: ModelProfile) {
  return createOutputCleaner(profile.stripOutput)(text, true).trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function waitForPoll(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Request aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function createTextStream(
  providerBody: ReadableStream<Uint8Array>,
  options: {
    abortController: AbortController;
    inactivityTimeoutMs: number;
    onCleanup?: () => void;
    requestSignal?: AbortSignal;
    stripOutput?: ModelProfile["stripOutput"];
  },
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = providerBody.getReader();
  const cleanOutput = createOutputCleaner(options.stripOutput);
  let buffer = "";
  let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let didCleanup = false;
  let timedOut = false;

  const clearInactivityTimeout = () => {
    if (inactivityTimeoutId) {
      clearTimeout(inactivityTimeoutId);
      inactivityTimeoutId = null;
    }
  };

  const resetInactivityTimeout = () => {
    clearInactivityTimeout();
    inactivityTimeoutId = setTimeout(() => {
      timedOut = true;
      options.abortController.abort();
    }, options.inactivityTimeoutMs);
  };

  const cleanup = () => {
    if (didCleanup) {
      return;
    }

    didCleanup = true;
    clearInactivityTimeout();
    options.requestSignal?.removeEventListener("abort", abortStream);
    options.onCleanup?.();
  };

  const abortStream = () => {
    options.abortController.abort();
    void reader.cancel().catch(() => undefined);
  };

  if (options.requestSignal?.aborted) {
    abortStream();
  } else {
    options.requestSignal?.addEventListener("abort", abortStream, { once: true });
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      resetInactivityTimeout();

      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>;

        try {
          result = await reader.read();
        } catch (error) {
          cleanup();

          if (error instanceof DOMException && error.name === "AbortError") {
            controller.error(
              timedOut ? new Error(cleanErrors.timeout) : error,
            );
            return;
          }

          controller.error(error);
          return;
        }

        const { done, value } = result;

        if (done) {
          cleanup();
          const remaining = cleanOutput(flushSseBuffer(buffer), true);

          if (remaining) {
            controller.enqueue(encoder.encode(remaining));
          }

          controller.close();
          return;
        }

        resetInactivityTimeout();
        buffer += decoder.decode(value, { stream: true });
        const splitIndex = buffer.lastIndexOf("\n\n");

        if (splitIndex === -1) {
          continue;
        }

        const chunk = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        const text = cleanOutput(parseSseText(chunk));

        if (text) {
          resetInactivityTimeout();
          controller.enqueue(encoder.encode(text));
          return;
        }
      }
    },
    cancel() {
      cleanup();
      options.abortController.abort();
      void reader.cancel().catch(() => undefined);
    },
  });
}

function createOutputCleaner(stripOutput?: ModelProfile["stripOutput"]) {
  let pending = "";

  return (text: string, flush = false) => {
    if (stripOutput !== "gemma-channel-tags" || !text) {
      return text;
    }

    pending += text;

    if (!flush && shouldHoldGemmaOutput(pending)) {
      return "";
    }

    const cleaned = stripGemmaChannelTags(pending, flush);
    pending = "";
    return cleaned;
  };
}

function shouldHoldGemmaOutput(text: string) {
  const trimmed = text.trimStart();
  const thoughtPrefix = "<|channel>thought";

  if (thoughtPrefix.startsWith(trimmed)) {
    return true;
  }

  if (trimmed.startsWith(thoughtPrefix) && !trimmed.includes("<channel|>")) {
    return true;
  }

  const partialTagIndex = text.lastIndexOf("<");

  if (partialTagIndex === -1) {
    return false;
  }

  const partialTag = text.slice(partialTagIndex);

  return ["<|channel>thought", "<|channel>final", "<channel|>"].some((tag) =>
    tag.startsWith(partialTag),
  );
}

function stripGemmaChannelTags(text: string, flush: boolean) {
  let cleaned = text
    .replace(/^\s*<\|channel\>thought[\s\S]*?<channel\|>/, "")
    .replace(/<\|channel\>thought[\s\S]*?<channel\|>/g, "")
    .replace(/<\|channel\>[a-z_]*\s*/gi, "")
    .replace(/<channel\|>/g, "");

  if (flush) {
    cleaned = cleaned.replace(/^\s*<\|channel\>thought[\s\S]*$/, "");
  }

  return cleaned;
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

  if (error instanceof Error && error.message === cleanErrors.timeout) {
    return { status: 504, message: cleanErrors.timeout };
  }

  if (error instanceof Error && error.message === cleanErrors.pendingWithoutId) {
    return { status: 502, message: cleanErrors.pendingWithoutId };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return { status: 504, message: cleanErrors.timeout };
  }

  if (error instanceof ProviderError) {
    console.warn(error.message);

    if (error.status === 401 || error.status === 403) {
      return { status: 502, message: cleanErrors.unauthorized };
    }

    if (error.status === 404) {
      return { status: 404, message: cleanErrors.unavailable };
    }

    if (error.status === 429) {
      return { status: 429, message: cleanErrors.rateLimited };
    }

    if (error.status === 400 || error.status === 422) {
      return { status: 422, message: cleanErrors.incompatible };
    }

    if (error.status === 202) {
      return { status: 502, message: cleanErrors.pendingWithoutId };
    }
  }

  return { status: 502, message: cleanErrors.failed };
}

class ProviderError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(
      detail
        ? `NVIDIA provider error ${status}: ${detail}`
        : `NVIDIA provider error ${status}`,
    );
  }
}

async function readProviderError(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  const body = await response.text().catch(() => "");
  const normalized = body.replace(/\s+/g, " ").trim().slice(0, 500);

  return normalized || contentType || "";
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
