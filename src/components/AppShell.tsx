"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runAiTask } from "@/lib/api";
import { createId, createSessionTitle } from "@/lib/format";
import { modelOptions } from "@/lib/models";
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
import type { ChatAttachment, ChatSession, Message, Settings } from "@/types/chat";
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

function getRecentHistory(session: ChatSession) {
  return session.messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.status === "done" &&
        message.content.trim(),
    )
    .slice(-10)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

export default function AppShell() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [instructions, setInstructions] = useState("");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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

  function updateSetting(nextSettings: Settings) {
    const modelBelongsToProvider = modelOptions.some(
      (model) => model.id === nextSettings.model,
    );

    setSettings({
      ...nextSettings,
      model: modelBelongsToProvider
        ? nextSettings.model
        : modelOptions[0]?.id ?? nextSettings.model,
    });
  }

  function updateActiveSession(updater: (session: ChatSession) => ChatSession) {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId ? updater(session) : session,
      ),
    );
  }

  function updateAssistantMessage(
    messageId: string,
    updater: (message: Message) => Message,
  ) {
    updateActiveSession((session) => ({
      ...session,
      messages: session.messages.map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    }));
  }

  function renameSession(id: string, title: string) {
    setSessions((current) =>
      current.map((session) =>
        session.id === id
          ? {
              ...session,
              title: title.trim() || session.title,
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    );
  }

  function deleteSession(id: string) {
    setSessions((current) => {
      const nextSessions = current.filter((session) => session.id !== id);
      const ensuredSessions = nextSessions.length ? nextSessions : [createEmptySession()];

      if (id === activeSessionId) {
        setActiveSessionId(ensuredSessions[0].id);
      }

      return ensuredSessions;
    });
  }

  function handleNewChat() {
    const session = createEmptySession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  }

  async function handleSubmit(prompt: string, attachments: ChatAttachment[]) {
    if (!activeSession || isSending) {
      return;
    }

    const now = new Date().toISOString();
    const titlePrompt = prompt || attachments[0]?.name || "Media analysis";
    const userMessage: Message = {
      id: createId("msg"),
      role: "user",
      content: prompt,
      createdAt: now,
      attachments,
      status: "done",
    };
    const assistantId = createId("msg");
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
      provider: "nvidia",
      model: settings.model,
      status: "running",
    };

    setIsSending(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    updateActiveSession((session) => ({
      ...session,
      title: session.messages.length ? session.title : createSessionTitle(titlePrompt),
      updatedAt: now,
      messages: [...session.messages, userMessage, assistantMessage],
    }));

    try {
      const response = await runAiTask({
        sessionId: activeSession.id,
        prompt,
        model: settings.model,
        instructions,
        attachments,
        history: getRecentHistory(activeSession),
        signal: abortController.signal,
        onToken: (token) => {
          updateAssistantMessage(assistantId, (message) => ({
            ...message,
            content: `${message.content}${token}`,
          }));
        },
      });
      const completedAt = new Date().toISOString();

      updateAssistantMessage(assistantId, (message) => ({
        ...message,
        content: message.content || response.content,
        completedAt,
        provider: "nvidia",
        model: response.model,
        status: "done",
      }));
      updateActiveSession((session) => ({ ...session, updatedAt: completedAt }));
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
                completedAt: failedAt,
                status: wasStopped ? "stopped" : "error",
              }
            : message,
        ),
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
    <div className="h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div
        className={`grid h-screen border-zinc-800 bg-black text-zinc-100 ${
          isSidebarCollapsed
            ? "grid-cols-[48px_1fr]"
            : "grid-cols-1 lg:grid-cols-[300px_1fr]"
        }`}
      >
        <aside className="flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
            {!isSidebarCollapsed ? (
              <span className="font-mono text-xs font-semibold text-zinc-400">
                Alaws lang.
              </span>
            ) : null}
            <button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="grid h-8 w-8 place-items-center rounded-md border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              type="button"
            >
              {isSidebarCollapsed ? ">" : "<"}
            </button>
          </div>
          {!isSidebarCollapsed ? (
            <>
              <ChatHistory
                activeSessionId={activeSessionId}
                sessions={sessions}
                onDeleteSession={deleteSession}
                onNewChat={handleNewChat}
                onRenameSession={renameSession}
                onSelectSession={setActiveSessionId}
              />
              <AiPanel
                models={modelOptions}
                settings={settings}
                onOpenInstructions={() => setIsInstructionsOpen(true)}
                onSettingsChange={updateSetting}
              />
            </>
          ) : null}
        </aside>
        <main className="flex h-screen min-h-0 flex-col bg-black">
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
