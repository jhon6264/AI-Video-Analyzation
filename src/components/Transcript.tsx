"use client";

import { useEffect, useRef } from "react";
import type { ChatSession } from "@/types/chat";
import AssistantTerminalOutput from "./AssistantTerminalOutput";
import CliEmptyState from "./CliEmptyState";
import UserCommandCard from "./UserCommandCard";

type TranscriptProps = {
  session?: ChatSession;
};

export default function Transcript({ session }: TranscriptProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const latestMessageState = session?.messages
    .map((message) => `${message.id}:${message.status}:${message.content.length}`)
    .join("|");

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [latestMessageState]);

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1.5rem,4vh,2rem)]"
      ref={scrollRef}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-[clamp(1rem,2vh,1.25rem)]">
        {!session?.messages.length ? (
          <div className="grid min-h-[45vh] place-items-center text-center">
            <CliEmptyState />
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
