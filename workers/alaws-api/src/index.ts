type Provider = "nvidia" | "openrouter";

type AnalyzeRequest = {
  sessionId: string;
  prompt: string;
  provider: Provider;
  model: string;
  instructions: string;
};

type AnalyzeResponse = {
  ok: true;
  provider: Provider;
  model: string;
  content: string;
  usage: {
    requestsRemaining: number;
    restoreTime: string;
    rateLimitSource: "provider-header" | "estimated" | "unknown";
  };
};

type Env = {
  NVIDIA_API_KEY: string;
  OPENROUTER_API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const cleanErrors = {
  busy: "The selected model is unavailable right now. Try again or choose another model.",
  invalid: "Send a prompt before running the model.",
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
      const providerResponse = await callProvider(
        validated.provider,
        validated.model,
        validated,
        env,
        request.signal,
      );
      const response: AnalyzeResponse = {
        ok: true,
        provider: validated.provider,
        model: validated.model,
        content: providerResponse.content,
        usage: providerResponse.usage,
      };

      return json(response, 200, corsHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : cleanErrors.busy;
      const status = message === cleanErrors.invalid ? 400 : 503;
      return json({ ok: false, error: message }, status, corsHeaders);
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
    provider: body.provider === "openrouter" ? "openrouter" : "nvidia",
    model: body.model?.trim() || "nvidia/cosmos-reason2-8b",
    instructions:
      body.instructions?.trim() ||
      "You are Alaws lang, a natural AI assistant similar to ChatGPT.",
  };
}

async function callProvider(
  provider: Provider,
  model: string,
  request: AnalyzeRequest,
  env: Env,
  signal: AbortSignal,
) {
  const endpoint =
    provider === "nvidia"
      ? "https://integrate.api.nvidia.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const apiKey = provider === "nvidia" ? env.NVIDIA_API_KEY : env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(`${provider} API key is missing`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": "https://alaws-lang.local",
            "X-Title": "Alaws lang.",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: request.instructions,
        },
        {
          role: "user",
          content: request.prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`${provider}:${model}:${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(`${provider}:${model}:empty response`);
  }

  return {
    content: normalizeTerminalOutput(content),
    usage: extractUsage(response),
  };
}

function extractUsage(response: Response): AnalyzeResponse["usage"] {
  const remaining = getNumericHeader(response.headers, [
    "x-ratelimit-remaining",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-requests-remaining",
  ]);
  const retryAfter = response.headers.get("retry-after");
  const reset = response.headers.get("x-ratelimit-reset");

  return {
    requestsRemaining: remaining ?? 47,
    restoreTime: retryAfter
      ? `in ${retryAfter}s`
      : reset
        ? `at ${reset}`
        : "provider-managed",
    rateLimitSource: remaining === undefined && !retryAfter && !reset
      ? "unknown"
      : "provider-header",
  };
}

function getNumericHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    const parsed = value ? Number.parseInt(value, 10) : Number.NaN;

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeTerminalOutput(content: string) {
  return content.startsWith(">") ? content : `> analysis complete\n\n${content}`;
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
