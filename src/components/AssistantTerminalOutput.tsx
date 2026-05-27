"use client";

import type { Message } from "@/types/chat";

type AssistantTerminalOutputProps = {
  message: Message;
};

const statusClassName = {
  queued: "text-orange-400",
  running: "text-orange-400",
  done: "text-green-400",
  error: "text-red-400",
} as const;

export default function AssistantTerminalOutput({
  message,
}: AssistantTerminalOutputProps) {
  return (
    <article className="max-w-4xl font-mono">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <span>[ai]</span>
        {message.provider ? <span>{message.provider}</span> : null}
        {message.model ? <span>{message.model}</span> : null}
        {message.status ? (
          <span className={statusClassName[message.status]}>{message.status}</span>
        ) : null}
      </div>
      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
        {message.content}
      </pre>
    </article>
  );
}
