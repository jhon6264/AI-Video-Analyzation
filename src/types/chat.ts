export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "queued" | "running" | "done" | "error";

export type ProviderId = "nvidia" | "openrouter";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  provider?: ProviderId;
  model?: string;
  status?: MessageStatus;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export type Settings = {
  provider: ProviderId;
  model: string;
  requestsRemaining: number;
  restoreTime: string;
  status: "active" | "processing" | "limited" | "error";
  fallback: boolean;
};
