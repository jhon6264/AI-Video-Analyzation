export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "queued" | "running" | "done" | "error" | "stopped";

export type ProviderId = "nvidia";

export type AttachmentKind = "image" | "video";

export type ChatAttachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  completedAt?: string;
  attachments?: ChatAttachment[];
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
  model: string;
};
