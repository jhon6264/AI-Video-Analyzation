"use client";

import { formatTime } from "@/lib/format";
import type { Message } from "@/types/chat";

type UserCommandCardProps = {
  message: Message;
};

export default function UserCommandCard({ message }: UserCommandCardProps) {
  return (
    <div className="flex flex-col items-end">
      <article className="ml-auto w-fit max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-2 flex items-center gap-3 text-xs text-zinc-600">
          <span className="font-mono">[user]</span>
        </div>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-200">
          {message.content || "Analyze the attached media."}
        </pre>
        {message.attachments?.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {message.attachments.map((attachment) => (
              <a
                className="group relative h-28 w-36 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-black"
                href={attachment.url}
                key={attachment.id}
                rel="noreferrer"
                target="_blank"
              >
                {attachment.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={attachment.name}
                    className="h-full w-full object-cover"
                    src={attachment.url}
                  />
                ) : (
                  <video
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    src={attachment.url}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-1 font-mono text-[10px] text-zinc-300">
                  <p className="truncate">{attachment.name}</p>
                  <p className="text-zinc-500">{attachment.kind}</p>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </article>
      <time className="mt-1 text-[10px] text-zinc-600">
        {formatTime(message.createdAt)}
      </time>
    </div>
  );
}