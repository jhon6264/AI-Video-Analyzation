"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { uploadMedia } from "@/lib/api";
import { createId } from "@/lib/format";
import type { ChatAttachment } from "@/types/chat";

type ComposerProps = {
  isSending: boolean;
  onSubmit: (prompt: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
};

type LocalAttachment = ChatAttachment & {
  previewUrl: string;
  status: "uploading" | "ready" | "error";
  error?: string;
};

export default function Composer({ isSending, onStop, onSubmit }: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef<LocalAttachment[]>([]);
  const hasUploadingAttachment = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const readyAttachments = attachments.filter(
    (attachment) => attachment.status === "ready",
  );
  const canSubmit =
    !isSending &&
    !hasUploadingAttachment &&
    (Boolean(prompt.trim()) || readyAttachments.length > 0);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }
    },
    [],
  );

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = prompt.trim();

    if (!canSubmit) {
      return;
    }

    onSubmit(
      value,
      readyAttachments.map(toChatAttachment),
    );
    setPrompt("");
    for (const attachment of attachments) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachments([]);
    textAreaRef.current?.focus();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    for (const file of files) {
      if (!isAllowedMedia(file)) {
        const id = createId("attachment");
        setAttachments((current) => [
          ...current,
          {
            id,
            kind: file.type.startsWith("video/") ? "video" : "image",
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            url: "",
            previewUrl: "",
            status: "error",
            error: "Use PNG, JPG, WebP, MP4, WebM, or MOV.",
          },
        ]);
        continue;
      }

      const id = createId("attachment");
      const previewUrl = URL.createObjectURL(file);
      const kind = file.type.startsWith("video/") ? "video" : "image";

      setAttachments((current) => [
        ...current,
        {
          id,
          kind,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          url: "",
          previewUrl,
          status: "uploading",
        },
      ]);

      try {
        const uploaded = await uploadMedia(file);
        setAttachments((current) =>
          current.map((attachment) =>
            attachment.id === id
              ? {
                  ...attachment,
                  ...uploaded,
                  id,
                  previewUrl,
                  status: "ready",
                }
              : attachment,
          ),
        );
      } catch (error) {
        setAttachments((current) =>
          current.map((attachment) =>
            attachment.id === id
              ? {
                  ...attachment,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Media upload failed.",
                }
              : attachment,
          ),
        );
      }
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id);

      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  return (
    <form
      className="shrink-0 border-t border-zinc-800 bg-black px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,2vh,1.5rem)]"
      onSubmit={submit}
    >
      <div className="mx-auto max-w-4xl flex items-center gap-3">
        <input
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
          aria-label="Upload image or video"
          className="hidden"
          multiple
          onChange={handleFiles}
          ref={fileInputRef}
          type="file"
        />
        <button
          aria-label="Attach image or video"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-zinc-800 text-lg text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
          disabled={isSending}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          +
        </button>
        <div className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 p-[clamp(0.5rem,1vw,0.75rem)] focus-within:border-zinc-600">
          {attachments.length ? (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {attachments.map((attachment) => (
                <div
                  className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-black"
                  key={attachment.id}
                >
                  {attachment.kind === "image" && attachment.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={attachment.name}
                      className="h-full w-full object-cover"
                      src={attachment.previewUrl}
                    />
                  ) : attachment.kind === "video" && attachment.previewUrl ? (
                    <video
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      src={attachment.previewUrl}
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-2 text-center font-mono text-[10px] text-zinc-500">
                      {attachment.name}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 px-2 py-1 font-mono text-[10px] text-zinc-300">
                    <p className="truncate">{attachment.name}</p>
                    <p
                      className={
                        attachment.status === "error"
                          ? "truncate text-red-300"
                          : "text-zinc-500"
                      }
                    >
                      {attachment.status === "uploading"
                        ? "uploading..."
                        : attachment.status === "ready"
                          ? "ready"
                          : attachment.error}
                    </p>
                  </div>
                  <button
                    aria-label={`Remove ${attachment.name}`}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded border border-zinc-700 bg-black/80 text-xs text-zinc-300 transition hover:border-red-500 hover:text-red-200"
                    onClick={() => removeAttachment(attachment.id)}
                    type="button"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <textarea
              aria-label="Message Alaws"
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 font-mono text-[clamp(0.8rem,1.2vw,0.875rem)] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
              disabled={isSending}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  submit();
                }
              }}
              placeholder="Ask Alaws lang"
              ref={textAreaRef}
              rows={2}
              value={prompt}
            />
            <button
              aria-label={isSending ? "Stop" : "Send"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border text-lg transition ${
                isSending
                  ? "border-red-900 text-red-300 hover:border-red-500 hover:text-red-200"
                  : "border-zinc-800 text-zinc-200 hover:border-green-500 hover:text-green-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              }`}
              disabled={!isSending && !canSubmit}
              onClick={isSending ? onStop : undefined}
              type={isSending ? "button" : "submit"}
            >
              {isSending ? <StopIcon /> : <span aria-hidden="true">&rarr;</span>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function toChatAttachment(attachment: LocalAttachment): ChatAttachment {
  return {
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
  };
}

function isAllowedMedia(file: File) {
  return [
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ].includes(file.type);
}

function StopIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
