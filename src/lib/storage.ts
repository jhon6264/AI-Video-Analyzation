import type { ChatSession, Settings } from "@/types/chat";
import { defaultInstructions } from "./prompts";

export const storageKeys = {
  sessions: "alaws.sessions",
  activeSessionId: "alaws.activeSessionId",
  settings: "alaws.settings",
  instructions: "alaws.instructions",
  aiPanelState: "alaws.aiPanelState",
} as const;

export const defaultSettings: Settings = {
  provider: "nvidia",
  model: "cosmos-reason2-8b",
  taskMode: "text",
  requestsRemaining: 47,
  restoreTime: "in 18m 24s",
  status: "active",
  fallback: true,
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadSessions() {
  return safeParse<ChatSession[]>(localStorage.getItem(storageKeys.sessions), []);
}

export function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(storageKeys.sessions, JSON.stringify(sessions));
}

export function loadActiveSessionId() {
  return localStorage.getItem(storageKeys.activeSessionId);
}

export function saveActiveSessionId(id: string) {
  localStorage.setItem(storageKeys.activeSessionId, id);
}

export function loadSettings() {
  return {
    ...defaultSettings,
    ...safeParse<Partial<Settings>>(localStorage.getItem(storageKeys.settings), {}),
  };
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(storageKeys.settings, JSON.stringify(settings));
}

export function loadInstructions() {
  return localStorage.getItem(storageKeys.instructions) ?? defaultInstructions;
}

export function saveInstructions(instructions: string) {
  localStorage.setItem(storageKeys.instructions, instructions);
}
