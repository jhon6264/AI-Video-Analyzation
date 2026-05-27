"use client";

import { formatTime } from "@/lib/format";
import type { Message } from "@/types/chat";

type UserCommandCardProps = {
  message: Message;
};

export default function UserCommandCard({ message }: UserCommandCardProps) {
  return (
    <article className="ml-auto w-full max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-600">
        <span className="font-mono">[user]</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-200">
        {message.content}
      </pre>
    </article>
  );
}
