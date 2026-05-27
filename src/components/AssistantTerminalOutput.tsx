"use client";

import { useEffect, useState } from "react";
import type { Message } from "@/types/chat";

type AssistantTerminalOutputProps = {
  message: Message;
};

const statusClassName = {
  queued: "text-orange-400",
  running: "text-orange-400",
  done: "text-green-400",
  error: "text-red-400",
  stopped: "text-zinc-500",
} as const;

const thinkingPhrases = ["Thinking", "Tanginamo", "Yanyan Toyab"];

export default function AssistantTerminalOutput({
  message,
}: AssistantTerminalOutputProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (message.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % thinkingPhrases.length);
    }, 700);

    return () => window.clearInterval(interval);
  }, [message.status]);

  const content =
    message.status === "running"
      ? `> ${thinkingPhrases[phraseIndex]}`
      : message.content;

  return (
    <article className="max-w-4xl font-mono">
      {message.status !== "running" ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span>[ai]</span>
          {message.provider ? <span>{message.provider}</span> : null}
          {message.model ? <span>{message.model}</span> : null}
          {message.status ? (
            <span className={statusClassName[message.status]}>{message.status}</span>
          ) : null}
        </div>
      ) : null}
      <pre
        className={`whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200 ${
          message.status === "running" ? "animate-pulse" : ""
        }`}
      >
        {content}
      </pre>
    </article>
  );
}
