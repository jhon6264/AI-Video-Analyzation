"use client";

import { useMemo, useState } from "react";
import { formatTime } from "@/lib/format";
import type { ChatSession } from "@/types/chat";

type ChatHistoryProps = {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onSelectSession: (id: string) => void;
};

export default function ChatHistory({
  sessions,
  activeSessionId,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  onSelectSession,
}: ChatHistoryProps) {
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 px-2 text-xs text-zinc-200 transition hover:border-green-500 hover:text-green-300"
          onClick={onNewChat}
          type="button"
        >
          <NewChatIcon />
          <span>New Chat</span>
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
        {filteredSessions.map((session) => {
          const isMenuOpen = openMenuId === session.id;

          return (
            <div className="relative" key={session.id}>
              <button
                className={`w-full rounded-md border py-2 pl-3 pr-9 text-left transition ${
                  session.id === activeSessionId
                    ? "border-green-700 bg-green-950/40 text-green-100"
                    : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
                onClick={() => onSelectSession(session.id)}
                type="button"
              >
                <span className="block truncate font-mono text-sm">
                  {session.title}
                </span>
                <span className="mt-1 block text-xs text-zinc-600">
                  {formatTime(session.updatedAt)}
                </span>
              </button>
              <button
                aria-label={`Open actions for ${session.title}`}
                className="absolute right-1.5 top-2 grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenuId((current) =>
                    current === session.id ? null : session.id,
                  );
                }}
                type="button"
              >
                &gt;
              </button>
              {isMenuOpen ? (
                <div className="absolute right-1 top-10 z-20 w-32 rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                  <button
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    onClick={() => {
                      const nextTitle = window.prompt("Rename chat", session.title);

                      if (nextTitle !== null) {
                        onRenameSession(session.id, nextTitle);
                      }

                      setOpenMenuId(null);
                    }}
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-red-300 hover:bg-red-950/40 hover:text-red-200"
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Delete "${session.title}"?`,
                      );

                      if (confirmed) {
                        onDeleteSession(session.id);
                      }

                      setOpenMenuId(null);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NewChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}
