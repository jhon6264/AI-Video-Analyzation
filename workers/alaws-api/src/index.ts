type Provider = "nvidia" | "openrouter";
type TaskMode = "text" | "image" | "video";

type AnalyzeRequest = {
  sessionId: string;
  prompt: string;
  provider: Provider;
  model: string;
  taskMode: TaskMode;
  instructions: string;
  fallback: boolean;
};

type AnalyzeResponse = {
  ok: true;
  provider: Provider;
  model: string;
  content: string;
  usage: {
    requestsRemaining: number;
    restoreTime: string;
  };
};

type Env = {
  NVIDIA_API_KEY: string;
  OPENROUTER_API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const fallbackOrder: Array<{ provider: Provider; model: string }> = [
  { provider: "nvidia", model: "nvidia/cosmos-reason2-8b" },
  { provider: "nvidia", model: "qwen/qwen3.5-122b-a10b" },
  { provider: "nvidia", model: "qwen/qwen3.5-397b-a17b" },
  { provider: "nvidia", model: "google/gemma-4-31b-it" },
  { provider: "nvidia", model: "google/gemma-3n-e4b-it" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free" },
];

const cleanErrors = {
  busy: "All providers are currently busy. Try again in a few minutes.",
  unsupported: "This model does not support the requested task. Try another model.",
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
      const candidates = buildCandidates(validated);
      const failures: string[] = [];

      for (const candidate of candidates) {
        try {
          const content = await callProvider(candidate.provider, candidate.model, validated, env);
          const response: AnalyzeResponse = {
            ok: true,
            provider: candidate.provider,
            model: candidate.model,
            content,
            usage: {
              requestsRemaining: 47,
              restoreTime: "provider-managed",
            },
          };

          return json(response, 200, corsHeaders);
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "provider failed");

          if (!validated.fallback) {
            break;
          }
        }
      }

      console.log("Provider failures", failures);
      return json({ ok: false, error: cleanErrors.busy }, 503, corsHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : cleanErrors.invalid;
      return json({ ok: false, error: message }, 400, corsHeaders);
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
    taskMode: normalizeTaskMode(body.taskMode),
    instructions: body.instructions?.trim() || "You are Alaws lang, a concise AI assistant.",
    fallback: body.fallback !== false,
  };
}

function normalizeTaskMode(taskMode: unknown): TaskMode {
  return taskMode === "image" || taskMode === "video" ? taskMode : "text";
}

function buildCandidates(request: AnalyzeRequest) {
  const selected = { provider: request.provider, model: request.model };

  if (!request.fallback) {
    return [selected];
  }

  return [
    selected,
    ...fallbackOrder.filter(
      (candidate) =>
        candidate.provider !== selected.provider || candidate.model !== selected.model,
    ),
  ];
}

async function callProvider(
  provider: Provider,
  model: string,
  request: AnalyzeRequest,
  env: Env,
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
          content: buildSystemPrompt(request),
        },
        {
          role: "user",
          content: request.prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
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

  return normalizeTerminalOutput(content);
}

function buildSystemPrompt(request: AnalyzeRequest) {
  const taskGuidance = {
    text: "The user is asking for normal text chat or assistance. Answer directly.",
    image:
      "The user is asking for image generation. If this endpoint cannot return image files, provide a polished image prompt, visual specification, and next-step guidance.",
    video:
      "The user is asking for video generation or video analysis. If a media URL is present, analyze it. If generation is requested and this endpoint cannot return video files, provide a polished video prompt, shot plan, and next-step guidance.",
  } satisfies Record<TaskMode, string>;

  return `${request.instructions}

Task mode: ${request.taskMode}
${taskGuidance[request.taskMode]}`;
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
