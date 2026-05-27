"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";
import MarkdownMessage from "./MarkdownMessage";

type AssistantTerminalOutputProps = {
  message: Message;
};

const thinkingPhrases = ["Thinking", "Papibords", "Eian Bading", "Hulat gamay", "Hapit na", "Almost done", "Here it comes", "Hakdog", "Ara na", "wait po", "kadali lang" ];

export default function AssistantTerminalOutput({
  message,
}: AssistantTerminalOutputProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [runningElapsedMs, setRunningElapsedMs] = useState(() =>
    getElapsedMs(message.createdAt),
  );

  useEffect(() => {
    if (message.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % thinkingPhrases.length);
    }, 700);

    return () => window.clearInterval(interval);
  }, [message.status]);

  useEffect(() => {
    if (message.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setRunningElapsedMs(getElapsedMs(message.createdAt));
    }, 70);

    return () => window.clearInterval(interval);
  }, [message.completedAt, message.createdAt, message.status]);

  if (message.status === "running" && !message.content) {
    return (
      <article className="max-w-4xl font-mono">
        <pre className="animate-pulse whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
          {`> ${formatElapsed(runningElapsedMs)}\n> ${thinkingPhrases[phraseIndex]}`}
        </pre>
      </article>
    );
  }

  if (message.status === "running") {
    return (
      <article className="max-w-4xl">
        <div className="mb-3 font-mono text-sm leading-6 text-zinc-400">
          &gt; Answering {formatElapsed(runningElapsedMs)}
        </div>
        <MarkdownMessage content={message.content} />
      </article>
    );
  }

  if (message.status === "done") {
    const elapsedMs = getElapsedMs(message.createdAt, message.completedAt);

    return (
      <article className="max-w-4xl">
        <div className="mb-3 font-mono text-sm leading-6 text-zinc-400">
          &gt; Answered {formatElapsed(elapsedMs)}
        </div>
        <MarkdownMessage content={message.content} />
      </article>
    );
  }

  const content =
    message.status === "stopped"
      ? `> stopped ${formatElapsed(getElapsedMs(message.createdAt, message.completedAt))}`
      : message.content;

  return (
    <article className="max-w-4xl font-mono">
      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
        {content}
      </pre>
    </article>
  );
}

function getElapsedMs(startedAt: string, completedAt?: string) {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();

  return Math.max(0, end - start);
}

function formatElapsed(ms: number) {
  return `${Math.floor(ms / 1000)}s`;
}
