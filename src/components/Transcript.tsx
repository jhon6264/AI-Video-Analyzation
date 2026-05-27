"use client";

import type { ChatSession } from "@/types/chat";
import AssistantTerminalOutput from "./AssistantTerminalOutput";
import UserCommandCard from "./UserCommandCard";

type TranscriptProps = {
  session?: ChatSession;
};

export default function Transcript({ session }: TranscriptProps) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {!session?.messages.length ? (
          <div className="rounded-md border border-dashed border-zinc-800 p-5 font-mono text-sm leading-6 text-zinc-500">
            <p>&gt; ready</p>
            <p>Paste a public or signed video URL directly into the prompt.</p>
            <p>Ask for summary, key moments, warnings, or action items.</p>
          </div>
        ) : null}
        {session?.messages.map((message) =>
          message.role === "user" ? (
            <UserCommandCard key={message.id} message={message} />
          ) : (
            <AssistantTerminalOutput key={message.id} message={message} />
          ),
        )}
      </div>
    </section>
  );
}
