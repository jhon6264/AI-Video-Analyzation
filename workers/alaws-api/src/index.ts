type AnalyzeRequest = {
  sessionId: string;
  prompt: string;
  model: string;
  instructions: string;
  history: AiMessage[];
};

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type Env = {
  NVIDIA_API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const NVIDIA_CHAT_COMPLETIONS_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";
const PROVIDER_TIMEOUT_MS = 45_000;

const cleanErrors = {
  invalid: "Send a prompt before running the model.",
  missingKey: "NVIDIA API key is not configured.",
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

    if (url.pathname !== "/api/analyze") {
      return json({ ok: false, error: "Not found" }, 404, corsHeaders);
    }

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
  },
};

export default worker;

function validateAnalyzeRequest(body: Partial<AnalyzeRequest>): AnalyzeRequest {
  if (!body.prompt?.trim()) {
    throw new Error(cleanErrors.invalid);
  }

  return {
    sessionId: body.sessionId ?? "session_unknown",
    prompt: body.prompt.trim(),
    model: body.model?.trim() || "google/gemma-3n-e4b-it",
    instructions:
      body.instructions?.trim() ||
      "You are Alaws lang, a natural AI assistant similar to ChatGPT.",
    history: normalizeHistory(body.history),
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

async function streamNvidia(
  request: AnalyzeRequest,
  env: Env,
  requestSignal: AbortSignal,
  corsHeaders: HeadersInit,
) {
  if (!env.NVIDIA_API_KEY) {
    throw new Error(cleanErrors.missingKey);
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), PROVIDER_TIMEOUT_MS);
  const signal = combineAbortSignals(requestSignal, timeoutController.signal);
  const response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        {
          role: "system",
          content: request.instructions,
        },
        ...request.history,
        {
          role: "user",
          content: request.prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      stream: true,
    }),
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
            delta?: { content?: string };
            message?: { content?: string };
          }>;
        };
        text +=
          parsed.choices?.[0]?.delta?.content ??
          parsed.choices?.[0]?.message?.content ??
          "";
      } catch {
        // Ignore malformed provider chunks and continue streaming valid chunks.
      }
    }
  }

  return text;
}

function normalizeError(error: unknown) {
  if (error instanceof Error && error.message === cleanErrors.invalid) {
    return { status: 400, message: cleanErrors.invalid };
  }

  if (error instanceof Error && error.message === cleanErrors.missingKey) {
    return { status: 500, message: cleanErrors.missingKey };
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
