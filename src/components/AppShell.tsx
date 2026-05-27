"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runAiTask } from "@/lib/api";
import { createId, createSessionTitle } from "@/lib/format";
import { getModelById, modelOptions } from "@/lib/models";
import Image from "next/image";
import logo from "@/assets/alawslanglogo.png";
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

function getSupportedModelForAttachments(
  selectedModelId: string,
  attachments: ChatAttachment[],
  prompt = "",
) {
  const selectedModel = getModelById(selectedModelId) ?? modelOptions[0];
  const promptMedia = extractMediaKinds(prompt);
  const hasVideo =
    attachments.some((attachment) => attachment.kind === "video") ||
    promptMedia.has("video");
  const hasImage =
    attachments.some((attachment) => attachment.kind === "image") ||
    promptMedia.has("image");

  if (hasVideo && !selectedModel?.supportsVideo) {
    return modelOptions.find((model) => model.supportsVideo) ?? selectedModel;
  }

  if (hasImage && !selectedModel?.supportsImage) {
    return modelOptions.find((model) => model.supportsImage) ?? selectedModel;
  }

  return selectedModel;
}

function extractMediaKinds(prompt: string) {
  const kinds = new Set<"image" | "video">();
  const matches = prompt.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];

  for (const rawUrl of matches) {
    const url = rawUrl.replace(/[),.]+$/, "");

    if (/\.(png|jpe?g|webp)$/i.test(url)) {
      kinds.add("image");
    }

    if (/\.(mp4|webm|mov)$/i.test(url)) {
      kinds.add("video");
    }
  }

  return kinds;
}

export default function AppShell() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [instructions, setInstructions] = useState("");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    const requestModel = getSupportedModelForAttachments(
      settings.model,
      attachments,
      prompt,
    );
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
      model: requestModel?.id ?? settings.model,
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
        model: requestModel?.id ?? settings.model,
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
        content:
          message.content ||
          response.content ||
          "The model finished without returning text. Try a shorter video or another video-capable model.",
        completedAt,
        provider: "nvidia",
        model: response.model,
        status: message.content || response.content ? "done" : "error",
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
    <div className="h-screen h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div
        className={`flex h-screen h-dvh border-zinc-800 bg-black text-zinc-100 lg:grid ${
          isSidebarCollapsed
            ? "lg:grid-cols-[48px_1fr]"
            : "lg:grid-cols-[300px_1fr]"
        }`}
      >
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <aside 
          className={`
            flex min-h-0 flex-col border-zinc-800 bg-zinc-950 transition-transform duration-300 ease-in-out
            fixed inset-y-0 left-0 z-50 w-72 border-r lg:relative lg:translate-x-0 lg:h-screen lg:border-b lg:border-r
            ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            ${isSidebarCollapsed ? "lg:w-[48px]" : "lg:w-[300px]"}
          `}
        >
          <div className="hidden lg:flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
            <div className="w-full" />
            <button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="grid h-8 w-8 place-items-center rounded-md text-zinc-400 transition hover:text-white"
              onClick={() => {
                setIsSidebarCollapsed((current) => !current);
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              type="button"
            >
              <SidebarToggleIcon isExpanded={!isSidebarCollapsed} />
            </button>
          </div>
          {(!isSidebarCollapsed || isMobileMenuOpen) ? (
            <>
              <ChatHistory
                activeSessionId={activeSessionId}
                sessions={sessions}
                onDeleteSession={deleteSession}
                onNewChat={handleNewChat}
                onRenameSession={renameSession}
                onSelectSession={(id) => {
                  setActiveSessionId(id);
                  setIsMobileMenuOpen(false);
                }}
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
        <main className="flex h-screen h-dvh min-h-0 flex-col bg-black">
          <header className="flex h-12 shrink-0 items-center justify-between px-[clamp(1rem,3vw,1.5rem)]">
            <div className="flex items-center gap-3">
              <button 
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-zinc-800 text-zinc-400 lg:hidden"
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                type="button"
              >
                {isMobileMenuOpen ? "<" : ">"}
              </button>
              <h1 className="font-mono text-[clamp(0.875rem,1.5vw,1rem)] font-semibold tracking-normal text-zinc-100">
                Alaws lage.
              </h1>
            </div>
            <Image 
              src={logo} 
              alt="Alaws lang logo" 
              className="h-8 w-8 object-contain"
            />
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

function SidebarToggleIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m10 8 4 4-4 4" />
    </svg>
  );
}
