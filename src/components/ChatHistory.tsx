"use client";

import { useMemo, useState } from "react";
import { formatTime } from "@/lib/format";
import type { ChatSession } from "@/types/chat";

type ChatHistoryProps = {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
};

export default function ChatHistory({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: ChatHistoryProps) {
  const [query, setQuery] = useState("");
  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) =>
        session.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, sessions],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-zinc-800 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-zinc-500">Chat History</p>
        <button
          className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-green-500 hover:text-green-300"
          onClick={onNewChat}
          type="button"
        >
          + New Chat
        </button>
      </div>
      <input
        aria-label="Search chats"
        className="mb-3 h-9 rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search chats..."
        value={query}
      />
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {filteredSessions.map((session) => (
          <button
            className={`w-full rounded-md border px-3 py-2 text-left transition ${
              session.id === activeSessionId
                ? "border-green-700 bg-green-950/40 text-green-100"
                : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
            }`}
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            type="button"
          >
            <span className="block truncate font-mono text-sm">{session.title}</span>
            <span className="mt-1 block text-xs text-zinc-600">
              {formatTime(session.updatedAt)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
