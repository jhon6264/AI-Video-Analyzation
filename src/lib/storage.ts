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
  model: "google/gemma-3n-e4b-it",
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
  const settings = {
    ...defaultSettings,
    ...safeParse<Partial<Settings>>(localStorage.getItem(storageKeys.settings), {}),
  };

  return {
    ...settings,
    model: normalizeStoredModel(settings.model),
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

function normalizeStoredModel(model: string) {
  const legacyModelIds: Record<string, string> = {
    "cosmos-reason2-8b": "nvidia/cosmos-reason2-8b",
    "Qwen3.5-122B-A10B": "qwen/qwen3.5-122b-a10b",
    "Qwen3.5-397B-A17B": "qwen/qwen3.5-397b-a17b",
    "Gemma 4 31B IT": "google/gemma-4-31b-it",
    "gemma-3n-e4b-it": "google/gemma-3n-e4b-it",
  };

  return legacyModelIds[model] ?? model;
}
