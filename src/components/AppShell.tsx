"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runAiTask } from "@/lib/api";
import { createId, createSessionTitle } from "@/lib/format";
import { getModelsForProvider } from "@/lib/models";
import {
  defaultSettings,
  loadActiveSessionId,
  loadInstructions,
  loadSessions,
  loadSettings,
  saveActiveSessionId,
  saveInstructions,
  saveSessions,
  saveSettings,
} from "@/lib/storage";
import type { ChatSession, Message, Settings } from "@/types/chat";
import AiPanel from "./AiPanel";
import ChatHistory from "./ChatHistory";
import Composer from "./Composer";
import InstructionsModal from "./InstructionsModal";
import Transcript from "./Transcript";

function createEmptySession(): ChatSession {
  const now = new Date().toISOString();

  return {
    id: createId("session"),
    title: "New analysis",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export default function AppShell() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [instructions, setInstructions] = useState("");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const storedSessions = loadSessions();
      const initialSession = storedSessions[0] ?? createEmptySession();
      const initialSessions = storedSessions.length ? storedSessions : [initialSession];
      const storedActiveId = loadActiveSessionId();
      const initialActiveId =
        storedActiveId &&
        initialSessions.some((session) => session.id === storedActiveId)
          ? storedActiveId
          : initialSession.id;

      setSessions(initialSessions);
      setActiveSessionId(initialActiveId);
      setSettings(loadSettings());
      setInstructions(loadInstructions());
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hasHydrated && sessions.length) {
      saveSessions(sessions);
    }
  }, [hasHydrated, sessions]);

  useEffect(() => {
    if (hasHydrated && activeSessionId) {
      saveActiveSessionId(activeSessionId);
    }
  }, [activeSessionId, hasHydrated]);

  useEffect(() => {
    if (hasHydrated) {
      saveSettings(settings);
    }
  }, [hasHydrated, settings]);

  useEffect(() => {
    if (hasHydrated && instructions) {
      saveInstructions(instructions);
    }
  }, [hasHydrated, instructions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  const activeModels = getModelsForProvider(settings.provider);

  function updateSetting(nextSettings: Settings) {
    const providerModels = getModelsForProvider(nextSettings.provider);
    const modelBelongsToProvider = providerModels.some(
      (model) => model.id === nextSettings.model,
    );

    setSettings({
      ...nextSettings,
      model: modelBelongsToProvider
        ? nextSettings.model
        : providerModels[0]?.id ?? nextSettings.model,
    });
  }

  function updateActiveSession(updater: (session: ChatSession) => ChatSession) {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId ? updater(session) : session,
      ),
    );
  }

  function handleNewChat() {
    const session = createEmptySession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  }

  async function handleSubmit(prompt: string) {
    if (!activeSession || isSending) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      content: prompt,
      createdAt: now,
      status: "done",
    };
    const assistantId = createId("msg");
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
      provider: settings.provider,
      model: settings.model,
      status: "running",
    };

    setIsSending(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setSettings((current) => ({ ...current, status: "processing" }));
    updateActiveSession((session) => ({
      ...session,
      title: session.messages.length ? session.title : createSessionTitle(prompt),
      updatedAt: now,
      messages: [...session.messages, userMessage, assistantMessage],
    }));

    try {
      const response = await runAiTask({
        sessionId: activeSession.id,
        prompt,
        provider: settings.provider,
        model: settings.model,
        instructions,
        fallback: settings.fallback,
        signal: abortController.signal,
      });
      const completedAt = new Date().toISOString();

      updateActiveSession((session) => ({
        ...session,
        updatedAt: completedAt,
        messages: session.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: response.content,
                provider: response.provider,
                model: response.model,
                status: "done",
              }
            : message,
        ),
      }));
      setSettings((current) => ({
        ...current,
        status: "active",
        provider: response.provider,
        model: response.model,
        requestsRemaining: response.usage.requestsRemaining,
        restoreTime: response.usage.restoreTime,
      }));
    } catch (error) {
      const failedAt = new Date().toISOString();
      const wasStopped = error instanceof Error && error.name === "AbortError";
      const content = wasStopped
        ? "> stopped"
        : error instanceof Error
          ? error.message
          : "All providers are currently busy. Try again in a few minutes.";

      updateActiveSession((session) => ({
        ...session,
        updatedAt: failedAt,
        messages: session.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: wasStopped ? content : `ERROR\n${content}`,
                status: wasStopped ? "stopped" : "error",
              }
            : message,
        ),
      }));
      setSettings((current) => ({
        ...current,
        status: wasStopped ? "active" : "error",
      }));
    } finally {
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-1 border-zinc-800 bg-black text-zinc-100 lg:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 lg:h-screen lg:border-b-0 lg:border-r">
          <ChatHistory
            activeSessionId={activeSessionId}
            sessions={sessions}
            onNewChat={handleNewChat}
            onSelectSession={setActiveSessionId}
          />
          <AiPanel
            models={activeModels}
            settings={settings}
            onOpenInstructions={() => setIsInstructionsOpen(true)}
            onSettingsChange={updateSetting}
          />
        </aside>
        <main className="flex min-h-screen flex-col bg-black">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4 sm:px-6">
            <div>
              <h1 className="font-mono text-sm font-semibold tracking-normal text-zinc-100">
                Alaws lang.
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                Terminal AI chat for text, image, and video tasks
              </p>
            </div>
            <button
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              onClick={() => setIsInstructionsOpen(true)}
              type="button"
            >
              settings
            </button>
          </header>
          <Transcript session={activeSession} />
          <Composer isSending={isSending} onStop={handleStop} onSubmit={handleSubmit} />
        </main>
      </div>
      {isInstructionsOpen ? (
        <InstructionsModal
          instructions={instructions}
          isOpen={isInstructionsOpen}
          onClose={() => setIsInstructionsOpen(false)}
          onSave={setInstructions}
        />
      ) : null}
    </div>
  );
}
