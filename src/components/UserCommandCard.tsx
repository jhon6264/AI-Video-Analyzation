"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/format";
import type { Message } from "@/types/chat";

type UserCommandCardProps = {
  message: Message;
};

export default function UserCommandCard({ message }: UserCommandCardProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bubbleRef.current) {
      return;
    }

    if (Date.now() - new Date(message.createdAt).getTime() > 1500) {
      return;
    }

    const animation = animate(bubbleRef.current, {
      opacity: [0, 1],
      translateX: [24, 0],
      scale: [0.98, 1],
      duration: 260,
      ease: "outCubic",
    });

    return () => {
      animation.revert();
    };
  }, [message.createdAt, message.id]);

  return (
    <div className="flex flex-col items-end" ref={bubbleRef}>
      <article className="relative ml-auto w-fit max-w-2xl rounded-[22px] rounded-br-md bg-zinc-900 px-4 py-3 text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.2)] after:absolute after:bottom-0 after:-right-1.5 after:h-4 after:w-4 after:rounded-bl-[16px] after:bg-zinc-900 after:content-['']">
        <p className="relative z-10 whitespace-pre-wrap break-words text-sm leading-6">
          {message.content || "Analyze the attached media."}
        </p>
        {message.attachments?.length ? (
          <div className="relative z-10 mt-3 flex gap-2 overflow-x-auto pb-1">
            {message.attachments.map((attachment) => (
              <a
                className="group relative h-28 w-36 shrink-0 overflow-hidden rounded-[16px] border border-zinc-800 bg-black"
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
